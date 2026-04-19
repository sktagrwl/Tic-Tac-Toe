package storage

import (
	"context"
	"encoding/json"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

type PlayerStats struct {
	UserID        string `json:"userId"`
	Wins          int    `json:"wins"`
	Losses        int    `json:"losses"`
	Draws         int    `json:"draws"`
	WinStreak     int    `json:"winStreak"`
	BestWinStreak int    `json:"bestWinStreak"`
	TotalGames    int    `json:"totalGames"`
}

func ReadStats(
	ctx context.Context,
	nk runtime.NakamaModule,
	userId string,
) (PlayerStats, error) {
	reads := []*runtime.StorageRead{
		{
			Collection: "player_stats",
			Key:        "stats",
			UserID:     userId,
		},
	}
	objects, err := nk.StorageRead(ctx, reads)
	if err != nil {
		return PlayerStats{}, err
	}

	if len(objects) == 0 {
		return PlayerStats{UserID: userId}, nil
	}
	var stats PlayerStats
	if err := json.Unmarshal([]byte(objects[0].Value), &stats); err != nil {
		return PlayerStats{}, err
	}
	return stats, nil
}

func WriteStats(
	ctx context.Context,
	nk runtime.NakamaModule,
	stats PlayerStats,
) error {
	data, err := json.Marshal(stats)
	if err != nil {
		return err
	}

	writes := []*runtime.StorageWrite{
		{
			Collection:      "player_stats",
			Key:             "stats",
			UserID:          stats.UserID,
			Value:           string(data),
			PermissionRead:  1, // owner-readable
			PermissionWrite: 0, // server-only writes
		},
	}

	_, err = nk.StorageWrite(ctx, writes)
	return err
}

// UpdateMatchStats reads, updates, and writes aggregate stats for both players,
// then appends a game history entry for each player.
// winner is a userId for a normal win, "draw" for a draw.
func UpdateMatchStats(
	ctx context.Context,
	nk runtime.NakamaModule,
	p1Id, p1Username, p1Symbol,
	p2Id, p2Username, p2Symbol,
	winner string,
	matchID string,
	shortCode string,
) error {
	p1, err := ReadStats(ctx, nk, p1Id)
	if err != nil {
		return err
	}
	p2, err := ReadStats(ctx, nk, p2Id)
	if err != nil {
		return err
	}

	p1.TotalGames++
	p2.TotalGames++

	var p1Result, p2Result string

	switch winner {
	case "draw":
		p1.Draws++
		p1.WinStreak = 0
		p2.Draws++
		p2.WinStreak = 0
		p1Result = "draw"
		p2Result = "draw"

	case p1Id:
		p1.Wins++
		p1.WinStreak++
		if p1.WinStreak > p1.BestWinStreak {
			p1.BestWinStreak = p1.WinStreak
		}
		p2.Losses++
		p2.WinStreak = 0
		p1Result = "win"
		p2Result = "loss"

	case p2Id:
		p2.Wins++
		p2.WinStreak++
		if p2.WinStreak > p2.BestWinStreak {
			p2.BestWinStreak = p2.WinStreak
		}
		p1.Losses++
		p1.WinStreak = 0
		p1Result = "loss"
		p2Result = "win"
	}

	if err := WriteStats(ctx, nk, p1); err != nil {
		return err
	}
	if err := WriteStats(ctx, nk, p2); err != nil {
		return err
	}

	// Write game history entries for both players (non-fatal on failure).
	now := time.Now().Unix()
	_ = WriteGameHistoryEntry(ctx, nk, p1Id, GameHistoryEntry{
		MatchID:      matchID,
		ShortCode:    shortCode,
		OpponentID:   p2Id,
		OpponentName: p2Username,
		Result:       p1Result,
		MySymbol:     p1Symbol,
		PlayedAt:     now,
	})
	_ = WriteGameHistoryEntry(ctx, nk, p2Id, GameHistoryEntry{
		MatchID:      matchID,
		ShortCode:    shortCode,
		OpponentID:   p1Id,
		OpponentName: p1Username,
		Result:       p2Result,
		MySymbol:     p2Symbol,
		PlayedAt:     now,
	})

	return nil
}
