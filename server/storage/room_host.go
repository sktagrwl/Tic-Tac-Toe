package storage

import (
	"context"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

type RoomHostRecord struct {
	HostId   string `json:"hostId"`
	HostName string `json:"hostName"`
}

const roomHostCollection = "room_hosts"

// SaveRoomHost stores host info keyed by matchId under the system account,
// so it can be retrieved in list_rooms without knowing the host's userId.
func SaveRoomHost(ctx context.Context, nk runtime.NakamaModule, matchId, hostId, hostName string) error {
	data, err := json.Marshal(RoomHostRecord{HostId: hostId, HostName: hostName})
	if err != nil {
		return err
	}
	_, err = nk.StorageWrite(ctx, []*runtime.StorageWrite{
		{
			Collection:      roomHostCollection,
			Key:             matchId,
			UserID:          systemUserId,
			Value:           string(data),
			PermissionRead:  2, // public read
			PermissionWrite: 0, // server-only writes
		},
	})
	return err
}

// GetRoomHostByMatchId retrieves host info for a room using only the matchId.
func GetRoomHostByMatchId(ctx context.Context, nk runtime.NakamaModule, matchId string) (RoomHostRecord, error) {
	objects, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{Collection: roomHostCollection, Key: matchId, UserID: systemUserId},
	})
	if err != nil || len(objects) == 0 {
		return RoomHostRecord{}, err
	}
	var rec RoomHostRecord
	if err := json.Unmarshal([]byte(objects[0].Value), &rec); err != nil {
		return RoomHostRecord{}, err
	}
	return rec, nil
}

// DeleteRoomHost removes the host record for a match.
func DeleteRoomHost(ctx context.Context, nk runtime.NakamaModule, matchId, _ string) error {
	return nk.StorageDelete(ctx, []*runtime.StorageDelete{
		{Collection: roomHostCollection, Key: matchId, UserID: systemUserId},
	})
}
