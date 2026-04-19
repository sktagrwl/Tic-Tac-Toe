package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

const gameHistoryCollection = "game_history"

// GameHistoryEntry is one game from a specific player's perspective.
type GameHistoryEntry struct {
	MatchID      string `json:"matchId"`
	ShortCode    string `json:"shortCode"`    // "" for quick match rooms
	OpponentID   string `json:"opponentId"`
	OpponentName string `json:"opponentName"`
	Result       string `json:"result"`       // "win" | "loss" | "draw"
	MySymbol     string `json:"mySymbol"`     // "X" | "O"
	PlayedAt     int64  `json:"playedAt"`     // Unix seconds
}

// GameHistoryPage is the paginated response returned by ListGameHistory.
type GameHistoryPage struct {
	Entries []GameHistoryEntry `json:"entries"`
	Cursor  string             `json:"cursor"`
	HasMore bool               `json:"hasMore"`
}

// historyKey returns a reverse-timestamp key so that ascending StorageList
// order yields newest entries first.
func historyKey() string {
	return fmt.Sprintf("%019d", math.MaxInt64-time.Now().UnixNano())
}

// WriteGameHistoryEntry stores a single game history record for one player.
func WriteGameHistoryEntry(
	ctx context.Context,
	nk runtime.NakamaModule,
	userID string,
	entry GameHistoryEntry,
) error {
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = nk.StorageWrite(ctx, []*runtime.StorageWrite{
		{
			Collection:      gameHistoryCollection,
			Key:             historyKey(),
			UserID:          userID,
			Value:           string(data),
			PermissionRead:  1, // owner-only
			PermissionWrite: 0, // server-only
		},
	})
	return err
}

// ListGameHistory returns a page of game history entries for a user, newest
// first. Pass an empty cursor to start from the beginning.
func ListGameHistory(
	ctx context.Context,
	nk runtime.NakamaModule,
	userID string,
	limit int,
	cursor string,
) (GameHistoryPage, error) {
	// Fetch one extra to detect whether more pages exist.
	objects, nextCursor, err := nk.StorageList(ctx, userID, userID, gameHistoryCollection, limit+1, cursor)
	if err != nil {
		return GameHistoryPage{}, err
	}

	hasMore := len(objects) > limit
	if hasMore {
		objects = objects[:limit]
	}

	entries := make([]GameHistoryEntry, 0, len(objects))
	for _, obj := range objects {
		var e GameHistoryEntry
		if err := json.Unmarshal([]byte(obj.Value), &e); err != nil {
			continue // skip malformed records
		}
		entries = append(entries, e)
	}

	returnedCursor := ""
	if hasMore {
		returnedCursor = nextCursor
	}

	return GameHistoryPage{
		Entries: entries,
		Cursor:  returnedCursor,
		HasMore: hasMore,
	}, nil
}
