package main

import (
	"github.com/heroiclabs/nakama-common/runtime"
	"context"
	"database/sql"
	"tictactoe-server/match"
    "tictactoe-server/rpc"
)
func main() {}

func InitModule(
    ctx context.Context,
    logger runtime.Logger,
    db *sql.DB,
    nk runtime.NakamaModule,
    initializer runtime.Initializer,
) error {
    // Register the authoritative match handler
    if err := initializer.RegisterMatch("tictactoe", func(
        ctx context.Context,
        logger runtime.Logger,
        db *sql.DB,
        nk runtime.NakamaModule,
    ) (runtime.Match, error) {
        return &match.TicTacToeMatch{}, nil
    }); err != nil {
        logger.Error("Failed to register match handler: %v", err)
        return err
    }

    // Register RPCs
    if err := initializer.RegisterRpc("find_match", rpc.RpcFindMatch); err != nil {
        logger.Error("Failed to register find_match RPC: %v", err)
        return err
    }
    if err := initializer.RegisterRpc("quick_match", rpc.RpcQuickMatch); err != nil {
        logger.Error("Failed to register quick_match RPC: %v", err)
        return err
    }
    if err := initializer.RegisterRpc("join_by_code", rpc.RpcJoinByCode); err != nil {
        logger.Error("Failed to register join_by_code RPC: %v", err)
        return err
    }
    if err := initializer.RegisterRpc("list_rooms", rpc.RpcListRooms); err != nil {
        logger.Error("Failed to register list_rooms RPC: %v", err)
        return err
    }
    if err := initializer.RegisterRpc("get_stats", rpc.RpcGetStatus); err != nil {
        logger.Error("Failed to register get_stats RPC: %v", err)
        return err
    }
    if err := initializer.RegisterRpc("get_game_history", rpc.RpcGetGameHistory); err != nil {
        logger.Error("Failed to register get_game_history RPC: %v", err)
        return err
    }

    logger.Info("TicTacToe plugin loaded successfully")
    return nil
}