package storage

import (
	"context"
	"encoding/json"
	"math/rand"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	roomCodesCollection     = "room_codes"      // code   → matchId
	roomMatchCodesCollection = "room_match_codes" // matchId → code
	codeChars               = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous 0/O/1/I
	codeLength              = 5
	// systemUserId is used as the owner for server-global records
	systemUserId = "00000000-0000-0000-0000-000000000000"
)

type roomCodeRecord struct {
	MatchId string `json:"matchId"`
}

type roomMatchCodeRecord struct {
	Code string `json:"code"`
}

// GenerateUniqueCode generates a random 5-char code, retrying if the code
// already exists in storage (collision avoidance).
func GenerateUniqueCode(ctx context.Context, nk runtime.NakamaModule) (string, error) {
	for attempts := 0; attempts < 10; attempts++ {
		code := randomCode()
		objects, err := nk.StorageRead(ctx, []*runtime.StorageRead{
			{Collection: roomCodesCollection, Key: code, UserID: systemUserId},
		})
		if err != nil {
			return "", err
		}
		if len(objects) == 0 {
			return code, nil // code is available
		}
	}
	return "", runtime.NewError("could not generate unique room code", 13)
}

func randomCode() string {
	b := make([]byte, codeLength)
	for i := range b {
		b[i] = codeChars[rand.Intn(len(codeChars))]
	}
	return string(b)
}

// SaveRoomCode writes the bidirectional code ↔ matchId mapping.
func SaveRoomCode(ctx context.Context, nk runtime.NakamaModule, code, matchId string) error {
	forward, _ := json.Marshal(roomCodeRecord{MatchId: matchId})
	reverse, _ := json.Marshal(roomMatchCodeRecord{Code: code})

	_, err := nk.StorageWrite(ctx, []*runtime.StorageWrite{
		{
			Collection:      roomCodesCollection,
			Key:             code,
			UserID:          systemUserId,
			Value:           string(forward),
			PermissionRead:  2, // public read
			PermissionWrite: 0,
		},
		{
			Collection:      roomMatchCodesCollection,
			Key:             matchId,
			UserID:          systemUserId,
			Value:           string(reverse),
			PermissionRead:  2,
			PermissionWrite: 0,
		},
	})
	return err
}

// GetMatchForCode resolves a short code to its current Nakama match ID.
func GetMatchForCode(ctx context.Context, nk runtime.NakamaModule, code string) (string, error) {
	objects, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{Collection: roomCodesCollection, Key: code, UserID: systemUserId},
	})
	if err != nil {
		return "", err
	}
	if len(objects) == 0 {
		return "", runtime.NewError("room not found", 5)
	}
	var rec roomCodeRecord
	if err := json.Unmarshal([]byte(objects[0].Value), &rec); err != nil {
		return "", err
	}
	return rec.MatchId, nil
}

// GetCodeForMatch resolves a Nakama match ID back to its short code.
func GetCodeForMatch(ctx context.Context, nk runtime.NakamaModule, matchId string) (string, error) {
	objects, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{Collection: roomMatchCodesCollection, Key: matchId, UserID: systemUserId},
	})
	if err != nil {
		return "", err
	}
	if len(objects) == 0 {
		return "", runtime.NewError("code not found for match", 5)
	}
	var rec roomMatchCodeRecord
	if err := json.Unmarshal([]byte(objects[0].Value), &rec); err != nil {
		return "", err
	}
	return rec.Code, nil
}

// RemapRoomCode points an existing code to a new match (used on rematch).
// It writes the new forward/reverse records and deletes the old reverse record.
func RemapRoomCode(ctx context.Context, nk runtime.NakamaModule, code, oldMatchId, newMatchId string) error {
	// Delete old reverse record
	_ = nk.StorageDelete(ctx, []*runtime.StorageDelete{
		{Collection: roomMatchCodesCollection, Key: oldMatchId, UserID: systemUserId},
	})
	// Write new mapping
	return SaveRoomCode(ctx, nk, code, newMatchId)
}

// DeleteForwardCode removes only the code→matchId forward mapping.
// The reverse mapping (matchId→code) is preserved so the rematch flow can
// still call GetCodeForMatch to remap the code to the new match.
func DeleteForwardCode(ctx context.Context, nk runtime.NakamaModule, code string) error {
	return nk.StorageDelete(ctx, []*runtime.StorageDelete{
		{Collection: roomCodesCollection, Key: code, UserID: systemUserId},
	})
}

// DeleteRoomCode removes both directions of the mapping (called on full cleanup).
func DeleteRoomCode(ctx context.Context, nk runtime.NakamaModule, code, matchId string) error {
	return nk.StorageDelete(ctx, []*runtime.StorageDelete{
		{Collection: roomCodesCollection, Key: code, UserID: systemUserId},
		{Collection: roomMatchCodesCollection, Key: matchId, UserID: systemUserId},
	})
}
