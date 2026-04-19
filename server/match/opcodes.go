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

    // Rematch flow (3-step: request → accept/decline → new game)
    // Client → Server: "I want a rematch" — server relays to opponent.
    // If opponent sends REMATCH_REQUEST while one is already pending, it is treated as an accept.
    OpRematchRequest int64 = 7
    // Client → Server: "I accept the rematch" — server creates new match, broadcasts code to both.
    // Also used as Server → Client to carry the new room code.
    OpRematch int64 = 6
    // Client → Server: "I decline the rematch" — server relays back to requester.
    OpRematchDecline int64 = 8
)

// Error codes sent inside OpError messages
const (
    ErrNotYourTurn  = 1
    ErrInvalidMove  = 2
    ErrGameNotReady = 3
)