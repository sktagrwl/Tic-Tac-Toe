// This is the heart of the entire backend. 
// Nakama calls these 7 methods at specific points in a match's lifecycle. 
// Every move, every join, every disconnect flows through here

package match

import (
    "context"
    "database/sql"
    "encoding/json"

    "github.com/heroiclabs/nakama-common/runtime"
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
    state := &MatchState{
        Board:    [9]string{},
        Phase:    PhaseWaiting,
        Players:  []PlayerInfo{},
        WinLine:  [3]int{-1, -1, -1},
    }
    tickRate := 1  // 1 tick per second (needed for timer mode in Phase 4)
    label := ""
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

    // If we now have 2 players, start the game
    if len(s.Players) == 2 {
        s.Phase = PhasePlaying
        s.CurrentTurn = s.Players[0].UserID // X always goes first

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

        // If game was in progress, opponent wins by forfeit
        if s.Phase == PhasePlaying {
            opponentID := OtherPlayerID(s, presence.GetUserId())
            s.Winner = opponentID
            s.Phase = PhaseFinished

            stateData, _ := json.Marshal(s)
            dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
            dispatcher.BroadcastMessage(OpGameOver, stateData, nil, nil, true)
        }
    }

    return s
}

// MatchLoop is called every tick. All move processing happens here.
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

    for _, msg := range messages {
        if msg.GetOpCode() != OpMove {
            continue
        }

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
            // Find the winning userId
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
            continue
        }

        // Check for draw
        if IsBoardFull(s.Board) {
            s.Winner = "draw"
            s.Phase = PhaseFinished

            stateData, _ := json.Marshal(s)
            dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
            dispatcher.BroadcastMessage(OpGameOver, stateData, nil, nil, true)
            continue
        }

        // Game continues — advance turn
        s.CurrentTurn = OtherPlayerID(s, senderID)
        stateData, _ := json.Marshal(s)
        dispatcher.BroadcastMessage(OpStateUpdate, stateData, nil, nil, true)
    }

    return s
}

// MatchTerminate is called when Nakama is shutting down the match.
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
