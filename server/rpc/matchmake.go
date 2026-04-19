package rpc

import (
    "context"
    "database/sql"
    "encoding/json"

    "github.com/heroiclabs/nakama-common/runtime"
    "tictactoe-server/match"
    "tictactoe-server/storage"
)

// RpcFindMatch creates a new private room, assigns it a 5-char short code,
// and returns {"code":"XXXXX"} to the client.
func RpcFindMatch(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    payload string,
) (string, error) {
    code, err := storage.GenerateUniqueCode(ctx, nk)
    if err != nil {
        logger.Error("find_match: failed to generate code: %v", err)
        return "", runtime.NewError("failed to generate room code", 13)
    }

    matchId, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{"isPublic": false})
    if err != nil {
        logger.Error("find_match: failed to create match: %v", err)
        return "", runtime.NewError("failed to create match", 13)
    }

    if err := storage.SaveRoomCode(ctx, nk, code, matchId); err != nil {
        logger.Error("find_match: failed to save room code: %v", err)
        return "", runtime.NewError("failed to save room code", 13)
    }

    response, err := json.Marshal(map[string]string{"code": code})
    if err != nil {
        return "", runtime.NewError("failed to encode response", 13)
    }
    return string(response), nil
}

// RpcQuickMatch finds an existing quick-match room that is waiting for a second
// player, or creates a new one. Returns {"code":"XXXXX"} — same short-code
// contract as RpcFindMatch so the rematch flow and GamePage routing work identically.
func RpcQuickMatch(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    payload string,
) (string, error) {
    minSize := 0
    maxSize := 1
    matches, err := nk.MatchList(ctx, 10, true, match.LabelQuick, &minSize, &maxSize, "")
    if err != nil {
        logger.Error("quick_match: failed to list matches: %v", err)
        return "", runtime.NewError("failed to list matches", 13)
    }

    var matchId, code string
    if len(matches) > 0 {
        // Join an existing waiting room — retrieve the code that was saved when it was created.
        matchId = matches[0].MatchId
        code, err = storage.GetCodeForMatch(ctx, nk, matchId)
        if err != nil || code == "" {
            logger.Error("quick_match: could not find code for existing match %s: %v", matchId, err)
            return "", runtime.NewError("failed to find room code for match", 13)
        }
        logger.Info("quick_match: joining existing match %s (code %s)", matchId, code)
    } else {
        // No waiting room — create one, generate a code, and save it.
        code, err = storage.GenerateUniqueCode(ctx, nk)
        if err != nil {
            logger.Error("quick_match: failed to generate code: %v", err)
            return "", runtime.NewError("failed to generate room code", 13)
        }
        matchId, err = nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{"isPublic": true})
        if err != nil {
            logger.Error("quick_match: failed to create match: %v", err)
            return "", runtime.NewError("failed to create match", 13)
        }
        if err := storage.SaveRoomCode(ctx, nk, code, matchId); err != nil {
            logger.Error("quick_match: failed to save room code: %v", err)
            return "", runtime.NewError("failed to save room code", 13)
        }
        logger.Info("quick_match: created new match %s (code %s)", matchId, code)
    }

    response, err := json.Marshal(map[string]string{"code": code})
    if err != nil {
        return "", runtime.NewError("failed to encode response", 13)
    }
    return string(response), nil
}

// RpcJoinByCode resolves a 5-char short code to its current Nakama match ID.
// Returns {"matchId":"..."}.
func RpcJoinByCode(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    payload string,
) (string, error) {
    var params struct {
        Code string `json:"code"`
    }
    if err := json.Unmarshal([]byte(payload), &params); err != nil || params.Code == "" {
        return "", runtime.NewError("missing code", 3)
    }

    matchId, err := storage.GetMatchForCode(ctx, nk, params.Code)
    if err != nil {
        logger.Warn("join_by_code: code %q not found: %v", params.Code, err)
        return "", runtime.NewError("room not found", 5)
    }

    // Verify the match still exists in memory (stale codes survive Nakama restarts).
    // If it's gone, clean up the dead code so it can be reused.
    if _, err := nk.MatchGet(ctx, matchId); err != nil {
        logger.Warn("join_by_code: code %q resolves to dead match %s — purging stale code", params.Code, matchId)
        _ = storage.DeleteRoomCode(ctx, nk, params.Code, matchId)
        return "", runtime.NewError("room no longer available", 5)
    }

    response, err := json.Marshal(map[string]string{"matchId": matchId})
    if err != nil {
        return "", runtime.NewError("failed to encode response", 13)
    }
    return string(response), nil
}

// roomEntry is what list_rooms returns per open room.
type roomEntry struct {
    Code     string          `json:"code"`
    HostName string          `json:"hostName"`
    HostId   string          `json:"hostId"`
    Stats    storage.PlayerStats `json:"stats"`
}

// RpcListRooms returns all private rooms that are currently waiting for a second
// player (label="open", exactly 1 presence). Each entry includes the short code,
// host info, and host stats for the hover card.
func RpcListRooms(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    payload string,
) (string, error) {
    one := 1
    matches, err := nk.MatchList(ctx, 50, true, match.LabelOpen, &one, &one, "")
    if err != nil {
        logger.Error("list_rooms: failed to list matches: %v", err)
        return "", runtime.NewError("failed to list rooms", 13)
    }

    entries := make([]roomEntry, 0, len(matches))
    for _, m := range matches {
        // Get host info from storage
        host, err := storage.GetRoomHostByMatchId(ctx, nk, m.MatchId)
        if err != nil || host.HostId == "" {
            continue // skip rooms whose host record is gone (race condition)
        }

        // Get short code
        code, err := storage.GetCodeForMatch(ctx, nk, m.MatchId)
        if err != nil || code == "" {
            continue
        }

        // Get host stats
        stats, err := storage.ReadStats(ctx, nk, host.HostId)
        if err != nil {
            stats = storage.PlayerStats{UserID: host.HostId}
        }

        entries = append(entries, roomEntry{
            Code:     code,
            HostName: host.HostName,
            HostId:   host.HostId,
            Stats:    stats,
        })
    }

    response, err := json.Marshal(entries)
    if err != nil {
        return "", runtime.NewError("failed to encode response", 13)
    }
    return string(response), nil
}
