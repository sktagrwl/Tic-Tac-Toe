package rpc

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
	"tictactoe-server/storage"
)

type getGameHistoryRequest struct {
	Cursor string `json:"cursor"`
	Limit  int    `json:"limit"`
}

// RpcGetGameHistory returns a paginated list of game history entries for the
// authenticated user, sorted newest-first.
func RpcGetGameHistory(
	ctx context.Context,
	logger runtime.Logger,
	db *sql.DB,
	nk runtime.NakamaModule,
	payload string,
) (string, error) {
	userID, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	if !ok || userID == "" {
		return "", runtime.NewError("unauthenticated", 16)
	}

	var req getGameHistoryRequest
	if payload != "" && payload != "{}" {
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			return "", runtime.NewError("invalid payload", 3)
		}
	}
	if req.Limit <= 0 || req.Limit > 50 {
		req.Limit = 10
	}

	page, err := storage.ListGameHistory(ctx, nk, userID, req.Limit, req.Cursor)
	if err != nil {
		logger.Error("get_game_history: failed for user %s: %v", userID, err)
		return "", runtime.NewError("internal server error", 13)
	}

	data, err := json.Marshal(page)
	if err != nil {
		return "", runtime.NewError("internal server error", 13)
	}
	return string(data), nil
}
