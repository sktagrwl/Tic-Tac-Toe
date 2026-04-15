package rpc

import (
    "context"
    "database/sql"
    "encoding/json"

    "github.com/heroiclabs/nakama-common/runtime"
)

// RpcFindMatch creates a new authoritative match and returns its ID.
// The client calls this RPC to get a match ID before joining.
func RpcFindMatch(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    payload string,
) (string, error) {
    matchID, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{})
    if err != nil {
        logger.Error("Failed to create match: %v", err)
        return "", runtime.NewError("failed to create match", 13)
    }

    response, err := json.Marshal(map[string]string{"matchId": matchID})
    if err != nil {
        return "", runtime.NewError("failed to encode response", 13)
    }

    return string(response), nil
}