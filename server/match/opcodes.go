package match
const (
    // Client → Server
    OpMove int64 = 1

    // Server → Client
    OpStateUpdate int64 = 2
    OpGameOver    int64 = 3
    OpPlayerJoin  int64 = 4
    OpPlayerLeave int64 = 5
    OpError       int64 = 99
)

// Error codes sent inside OpError messages
const (
    ErrNotYourTurn  = 1
    ErrInvalidMove  = 2
    ErrGameNotReady = 3
)