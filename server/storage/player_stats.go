package storage

import (
	"context"
	"encoding/json"
	"github.com/heroiclabs/nakama-common/runtime"
)

type PlayerStats struct {
    UserID       string `json:"userId"`
    Wins         int    `json:"wins"`
    Losses       int    `json:"losses"`
    Draws        int    `json:"draws"`
    WinStreak    int    `json:"winStreak"`
    BestWinStreak int   `json:"bestWinStreak"`
    TotalGames   int    `json:"totalGames"`
}


func ReadStats (
	ctx context.Context,
	nk runtime.NakamaModule,
	userId string,
) (PlayerStats, error) {
	reads := []*runtime.StorageRead{
		{
			Collection: "player_stats",
			Key: "stats",
			UserID: userId,
		},
	}
	// nk.StorageRead() takes []*runtime.StorageRead and returns []*api.StorageObject
	objects, err := nk.StorageRead(ctx, reads)
	if(err != nil){
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

// UpdateMatchStats reads, updates, and writes stats for both players after a game ends.
// winner is a userId for a normal win, "draw" for a draw, or "" to skip (shouldn't happen).

func UpdateMatchStats(
	ctx context.Context,
	nk runtime.NakamaModule,
	playerOneId string,
	playerTwoId string,
	winner string,
) error {
	p1, err := ReadStats(ctx, nk, playerOneId)
	if err != nil {
		return err
	}
	p2, err := ReadStats(ctx, nk, playerTwoId)
	if err != nil {
		return err
	}

	p1.TotalGames++
	p2.TotalGames++

	switch winner{
		case "draw":
			p1.Draws++
			p1.WinStreak = 0
			p2.Draws++
			p2.WinStreak = 0
		
		case playerOneId:
			p1.Wins++
			p1.WinStreak++
			if p1.WinStreak > p1.BestWinStreak {
				p1.BestWinStreak = p1.WinStreak
			}
			p2.Losses++
			p2.WinStreak = 0
		
		case playerTwoId:
			p2.Wins++
			p2.WinStreak++
			if p2.WinStreak > p2.BestWinStreak {
				p2.BestWinStreak = p2.WinStreak
			}
			p1.Losses++
			p1.WinStreak = 0
	}
	if err := WriteStats(ctx, nk, p1); err != nil {
		return err
	}
	return WriteStats(ctx, nk, p2)
	
}
