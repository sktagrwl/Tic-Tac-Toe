package rpc

import(
	"context"
	"github.com/heroiclabs/nakama-common/runtime"
	"tictactoe-server/storage"
	"database/sql"
	"encoding/json"
)

func RpcGetStatus(
	ctx context.Context,
	logger runtime.Logger,
	db *sql.DB,
	nk runtime.NakamaModule,
	payload string,
) (string, error) {
	userID, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	if !ok || userID == "" {
		return "", runtime.NewError("Unauthenticated", 16)
	}

	stats, err := storage.ReadStats(ctx, nk, userID)
	
	if err != nil {
		logger.Error("get_status : failed to read stats for %s: %v", userID, err)
		return "", runtime.NewError("Internal Server Error", 13)
	}

	data, err := json.Marshal(stats)
	if err != nil {
		return "", runtime.NewError("Internal Server Error", 13)
	}

	return string(data), nil
}