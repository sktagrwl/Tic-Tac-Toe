// This is the heart of the entire backend.
// Nakama calls these 7 methods at specific points in a match's lifecycle.
// Every move, every join, every disconnect flows through here

package match

import (
    "context"
    "database/sql"
    "encoding/json"

    "github.com/heroiclabs/nakama-common/runtime"
    "tictactoe-server/storage"
)

// TicTacToeMatch implements the Nakama runtime.Match interface
type TicTacToeMatch struct{}

// MoveMessage is what the client sends when making a move
type MoveMessage struct {
    Position int `json:"position"` // 0–8
}

// MatchInit is called once when the match is first created.
// Sets the initial state and tick rate.
func (m *TicTacToeMatch) MatchInit(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    params map[string]interface{},
) (interface{}, int, string) {
    isPublic := false
    if v, ok := params["isPublic"]; ok {
        if b, ok := v.(bool); ok {
            isPublic = b
        }
    }

    state := &MatchState{
        Board:    [9]string{},
        Phase:    PhaseWaiting,
        Players:  []PlayerInfo{},
        WinLine:  [3]int{-1, -1, -1},
        IsPublic: isPublic,
    }

    tickRate := 1 // 1 tick per second
    label := ""
    if isPublic {
        label = LabelQuick // quick-match rooms start as "quick"
    }
    return state, tickRate, label
}

// MatchJoinAttempt is called before a player joins.
// Return false to reject the join.
func (m *TicTacToeMatch) MatchJoinAttempt(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    dispatcher runtime.MatchDispatcher,
    tick int64,
    state interface{},
    presence runtime.Presence,
    metadata map[string]string,
) (interface{}, bool, string) {
    s := state.(*MatchState)

    // Reject if match is already full or finished
    activePlayers := 0
    for _, p := range s.Players {
        if p.Presence {
            activePlayers++
        }
    }
    if activePlayers >= 2 || s.Phase == PhaseFinished {
        return s, false, "match is full or finished"
    }

    return s, true, ""
}

// MatchJoin is called after a player successfully joins.
func (m *TicTacToeMatch) MatchJoin(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    dispatcher runtime.MatchDispatcher,
    tick int64,
    state interface{},
    presences []runtime.Presence,
) interface{} {
    s := state.(*MatchState)
    matchId := ctx.Value(runtime.RUNTIME_CTX_MATCH_ID).(string)

    for _, presence := range presences {
        // Assign symbol: first player gets X, second gets O
        symbol := "X"
        if len(s.Players) == 1 {
            symbol = "O"
        }

        player := PlayerInfo{
            UserID:   presence.GetUserId(),
            Username: presence.GetUsername(),
            Symbol:   symbol,
            Presence: true,
        }
        s.Players = append(s.Players, player)

        // Broadcast join event to all players
        data, _ := json.Marshal(player)
        dispatcher.BroadcastMessage(OpPlayerJoin, data, nil, nil, true)
    }

    switch len(s.Players) {
    case 1:
        // First player joined — advertise this room for discovery
        host := s.Players[0]
        if !s.IsPublic {
            // Private room: set label to "open" so it appears in room discovery
            dispatcher.MatchLabelUpdate(LabelOpen)
        }
        // Store host info so list_rooms can return it without needing presences
        if err := storage.SaveRoomHost(ctx, nk, matchId, host.UserID, host.Username); err != nil {
            logger.Error("MatchJoin: failed to save room host: %v", err)
        }
        // Send full state so the host's own players array is populated immediately.
        // Without this, the client has no symbol/role info until the second player joins.
        stateData, _ := json.Marshal(s)
        dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)

    case 2:
        // Second player joined — game starts, remove from all discovery pools
        s.Phase = PhasePlaying
        s.CurrentTurn = s.Players[0].UserID // X always goes first

        dispatcher.MatchLabelUpdate("")
        if err := storage.DeleteRoomHost(ctx, nk, matchId, s.Players[0].UserID); err != nil {
            logger.Error("MatchJoin: failed to delete room host: %v", err)
        }

        stateData, _ := json.Marshal(s)
        dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
    }

    return s
}

// MatchLeave is called when a player disconnects.
func (m *TicTacToeMatch) MatchLeave(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    dispatcher runtime.MatchDispatcher,
    tick int64,
    state interface{},
    presences []runtime.Presence,
) interface{} {
    s := state.(*MatchState)
    matchId := ctx.Value(runtime.RUNTIME_CTX_MATCH_ID).(string)

    for _, presence := range presences {
        // Mark player as disconnected
        for i, p := range s.Players {
            if p.UserID == presence.GetUserId() {
                s.Players[i].Presence = false
            }
        }

        // Broadcast leave event
        data, _ := json.Marshal(map[string]string{"userId": presence.GetUserId()})
        dispatcher.BroadcastMessage(OpPlayerLeave, data, nil, nil, true)

        // If the host left while still waiting, pull the room from all discovery pools
        // and remove the code→matchId mapping so nobody can join an abandoned room.
        if s.Phase == PhaseWaiting {
            dispatcher.MatchLabelUpdate("")
            if err := storage.DeleteRoomHost(ctx, nk, matchId, presence.GetUserId()); err != nil {
                logger.Error("MatchLeave: failed to delete room host: %v", err)
            }
            if waitingCode, err := storage.GetCodeForMatch(ctx, nk, matchId); err == nil && waitingCode != "" {
                if err := storage.DeleteForwardCode(ctx, nk, waitingCode); err != nil {
                    logger.Error("MatchLeave: failed to delete forward code for waiting room: %v", err)
                }
            }
        }

        // If game was in progress, opponent wins by forfeit
        if s.Phase == PhasePlaying {
            opponentID := OtherPlayerID(s, presence.GetUserId())
            if opponentID == "" {
                // Opponent not found in player list — corrupted state, skip forfeit
                logger.Error("MatchLeave: could not find opponent for forfeit (userId=%s)", presence.GetUserId())
                continue
            }
            s.Winner = opponentID
            s.Phase = PhaseFinished

            stateData, _ := json.Marshal(s)
            dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
            dispatcher.BroadcastMessage(OpGameOver, stateData, nil, nil, true)
            if len(s.Players) == 2 {
                forfeitShortCode, _ := storage.GetCodeForMatch(ctx, nk, matchId)
                if err := storage.UpdateMatchStats(
                    ctx, nk,
                    s.Players[0].UserID, s.Players[0].Username, s.Players[0].Symbol,
                    s.Players[1].UserID, s.Players[1].Username, s.Players[1].Symbol,
                    s.Winner, matchId, forfeitShortCode,
                ); err != nil {
                    logger.Error("failed to update stats after forfeit: %v", err)
                }
                // Remove forward code so stale join attempts fail fast.
                if forfeitShortCode != "" {
                    if err := storage.DeleteForwardCode(ctx, nk, forfeitShortCode); err != nil {
                        logger.Error("MatchLeave: failed to delete forward code after forfeit: %v", err)
                    }
                }
            }
        }
    }

    return s
}

// MatchLoop is called every tick. All move and rematch processing happens here.
func (m *TicTacToeMatch) MatchLoop(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    dispatcher runtime.MatchDispatcher,
    tick int64,
    state interface{},
    messages []runtime.MatchData,
) interface{} {
    s := state.(*MatchState)
    matchId := ctx.Value(runtime.RUNTIME_CTX_MATCH_ID).(string)

    for _, msg := range messages {
        switch msg.GetOpCode() {

        case OpRematchRequest:
            // Player is requesting a rematch. If no request is pending, relay to
            // the opponent and record who asked. If the opponent already requested
            // (race condition — both players clicked "Play Again"), treat this as
            // an implicit accept and fall through to create the new match.
            if s.Phase != PhaseFinished || s.RematchId != "" {
                continue
            }

            senderID := msg.GetUserId()

            if s.RematchRequesterId == "" {
                // First request — record it and notify opponent.
                s.RematchRequesterId = senderID
                opponentID := OtherPlayerID(s, senderID)
                var opponentPresence runtime.Presence
                for _, p := range s.Players {
                    if p.UserID == opponentID {
                        opponentPresence = msg // placeholder; we broadcast by userId below
                        _ = opponentPresence
                        break
                    }
                }
                // Broadcast to all (both players) but filter to opponent by userId
                reqData, _ := json.Marshal(map[string]string{"from": senderID})
                // Send only to presences of the opponent
                var targets []runtime.Presence
                // Use nil targets = broadcast to all; filter on client via userId check is simpler
                // because we don't have a Presence handle here. Instead we send to all —
                // the client ignores the message if it came from itself.
                dispatcher.BroadcastMessage(OpRematchRequest, reqData, targets, nil, true)
                continue
            }

            if s.RematchRequesterId == senderID {
                // Same player clicked again — ignore.
                continue
            }

            // Opponent sent a request while we already had one pending: treat as accept.
            fallthrough

        case OpRematch:
            // Accept the pending rematch request and start a new game.
            // Guards: game must be finished, no rematch already created, and a
            // request must be pending from the *other* player.
            if s.Phase != PhaseFinished || s.RematchId != "" {
                continue
            }
            senderID := msg.GetUserId()
            // If coming via OpRematch directly, ensure a request was made by the opponent.
            if msg.GetOpCode() == OpRematch && (s.RematchRequesterId == "" || s.RematchRequesterId == senderID) {
                continue
            }

            code, err := storage.GetCodeForMatch(ctx, nk, matchId)
            if err != nil {
                logger.Error("MatchLoop: rematch: could not find code for match %s: %v", matchId, err)
                continue
            }

            newMatchId, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{"isPublic": false})
            if err != nil {
                logger.Error("MatchLoop: rematch: failed to create new match: %v", err)
                continue
            }

            if err := storage.RemapRoomCode(ctx, nk, code, matchId, newMatchId); err != nil {
                logger.Error("MatchLoop: rematch: failed to remap code: %v", err)
                continue
            }

            s.RematchId = newMatchId
            respData, _ := json.Marshal(map[string]string{"code": code})
            dispatcher.BroadcastMessage(OpRematch, respData, nil, nil, true)

        case OpRematchDecline:
            // Opponent declined. Clear the pending request and notify the requester.
            if s.Phase != PhaseFinished || s.RematchRequesterId == "" {
                continue
            }
            s.RematchRequesterId = ""
            declineData, _ := json.Marshal(map[string]string{})
            dispatcher.BroadcastMessage(OpRematchDecline, declineData, nil, nil, true)

        case OpMove:
            senderID := msg.GetUserId()

            // Validation 1: game must be in progress
            if s.Phase != PhasePlaying {
                sendError(dispatcher, msg, ErrGameNotReady, "game is not in progress")
                continue
            }

            // Validation 2: must be this player's turn
            if senderID != s.CurrentTurn {
                sendError(dispatcher, msg, ErrNotYourTurn, "it is not your turn")
                continue
            }

            // Validation 3: decode and validate the move
            var move MoveMessage
            if err := json.Unmarshal(msg.GetData(), &move); err != nil {
                sendError(dispatcher, msg, ErrInvalidMove, "invalid message format")
                continue
            }
            if move.Position < 0 || move.Position > 8 || s.Board[move.Position] != "" {
                sendError(dispatcher, msg, ErrInvalidMove, "invalid position")
                continue
            }

            // Apply the move
            symbol := SymbolForUser(s, senderID)
            s.Board[move.Position] = symbol
            s.MoveCount++

            // Check for winner
            winSymbol, winLine := CheckWinner(s.Board)
            if winSymbol != "" {
                for _, p := range s.Players {
                    if p.Symbol == winSymbol {
                        s.Winner = p.UserID
                        break
                    }
                }
                s.WinLine = winLine
                s.Phase = PhaseFinished

                stateData, _ := json.Marshal(s)
                dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
                dispatcher.BroadcastMessage(OpGameOver, stateData, nil, nil, true)
                if len(s.Players) == 2 {
                    winShortCode, _ := storage.GetCodeForMatch(ctx, nk, matchId)
                    if err := storage.UpdateMatchStats(
                        ctx, nk,
                        s.Players[0].UserID, s.Players[0].Username, s.Players[0].Symbol,
                        s.Players[1].UserID, s.Players[1].Username, s.Players[1].Symbol,
                        s.Winner, matchId, winShortCode,
                    ); err != nil {
                        logger.Error("Failed to update match stats after win: %v", err)
                    }
                    // Remove the forward code→matchId mapping so stale join attempts
                    // fail fast. The reverse mapping is kept so a rematch can remap it.
                    if winShortCode != "" {
                        if err := storage.DeleteForwardCode(ctx, nk, winShortCode); err != nil {
                            logger.Error("MatchLoop: failed to delete forward code after win: %v", err)
                        }
                    }
                }
                continue
            }

            // Check for draw
            if IsBoardFull(s.Board) {
                s.Winner = "draw"
                s.Phase = PhaseFinished

                stateData, _ := json.Marshal(s)
                dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
                dispatcher.BroadcastMessage(OpGameOver, stateData, nil, nil, true)
                if len(s.Players) == 2 {
                    drawShortCode, _ := storage.GetCodeForMatch(ctx, nk, matchId)
                    if err := storage.UpdateMatchStats(
                        ctx, nk,
                        s.Players[0].UserID, s.Players[0].Username, s.Players[0].Symbol,
                        s.Players[1].UserID, s.Players[1].Username, s.Players[1].Symbol,
                        s.Winner, matchId, drawShortCode,
                    ); err != nil {
                        logger.Error("Failed to update match stats after draw: %v", err)
                    }
                    // Remove forward code so stale join attempts fail fast.
                    if drawShortCode != "" {
                        if err := storage.DeleteForwardCode(ctx, nk, drawShortCode); err != nil {
                            logger.Error("MatchLoop: failed to delete forward code after draw: %v", err)
                        }
                    }
                }
                continue
            }

            // Game continues — advance turn
            s.CurrentTurn = OtherPlayerID(s, senderID)
            stateData, _ := json.Marshal(s)
            dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
        }
    }

    // Terminate the match once all presences are gone, regardless of phase.
    // This covers both finished games (both players left after game over) and
    // abandoned waiting rooms (host disconnected before anyone joined).
    // Returning nil signals Nakama to call MatchTerminate for final cleanup.
    allGone := len(s.Players) > 0
    for _, p := range s.Players {
        if p.Presence {
            allGone = false
            break
        }
    }
    if allGone {
        return nil
    }

    return s
}

// MatchTerminate is called when Nakama shuts down or force-terminates the match.
func (m *TicTacToeMatch) MatchTerminate(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    dispatcher runtime.MatchDispatcher,
    tick int64,
    state interface{},
    graceSeconds int,
) interface{} {
    matchId := ctx.Value(runtime.RUNTIME_CTX_MATCH_ID).(string)
    // Best-effort cleanup: delete any lingering room_codes and room_hosts records.
    if code, err := storage.GetCodeForMatch(ctx, nk, matchId); err == nil && code != "" {
        if err := storage.DeleteRoomCode(ctx, nk, code, matchId); err != nil {
            logger.Error("MatchTerminate: failed to delete room code: %v", err)
        }
    }
    if err := storage.DeleteRoomHost(ctx, nk, matchId, ""); err != nil {
        logger.Error("MatchTerminate: failed to delete room host: %v", err)
    }
    return state
}

// MatchSignal handles out-of-band signals sent to the match (unused for now).
func (m *TicTacToeMatch) MatchSignal(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    dispatcher runtime.MatchDispatcher,
    tick int64,
    state interface{},
    data string,
) (interface{}, string) {
    return state, ""
}

// sendError sends an OpError message back to a specific player
func sendError(dispatcher runtime.MatchDispatcher, msg runtime.MatchData, code int, message string) {
    data, _ := json.Marshal(map[string]interface{}{
        "code":    code,
        "message": message,
    })
    presences := []runtime.Presence{msg}
    dispatcher.BroadcastMessage(OpError, data, presences, nil, true)
}
