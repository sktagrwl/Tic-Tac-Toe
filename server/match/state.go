// This file defines the authoritative game state — the single struct that Nakama holds in 
// memory for every live match. It also contains the pure board logic functions.

package match

// MatchPhase represents the lifecycle stage of a game
type MatchPhase string

const (
    PhaseWaiting  MatchPhase = "waiting"
    PhasePlaying  MatchPhase = "playing"
    PhaseFinished MatchPhase = "finished"
)

// PlayerInfo holds per-player data inside the match
type PlayerInfo struct {
    UserID   string `json:"userId"`
    Username string `json:"username"`
    Symbol   string `json:"symbol"`   // "X" or "O"
    Presence bool   `json:"presence"`
}

// MatchState is the full authoritative state Nakama keeps in memory
type MatchState struct {
    Board       [9]string    `json:"board"`
    Phase       MatchPhase   `json:"phase"`
    CurrentTurn string       `json:"currentTurn"` // userId
    Players     []PlayerInfo `json:"players"`
    Winner      string       `json:"winner"`       // userId | "draw" | ""
    WinLine     [3]int       `json:"winLine"`      // [-1,-1,-1] when none
    MoveCount   int          `json:"moveCount"`
    IsPublic           bool   `json:"isPublic"`           // true = quick-match pool room
    RematchId          string `json:"rematchId"`          // non-empty once a rematch has been created
    RematchRequesterId string `json:"rematchRequesterId"` // userId who sent the pending request
}

const (
    // LabelOpen marks a private room whose host is waiting — shown in room discovery.
    LabelOpen = "open"
    // LabelQuick marks a quick-match room — shown in the quick-match pool, NOT in discovery.
    LabelQuick = "quick"
)

// CheckWinner returns the winning symbol ("X" or "O") and the winning line indices.
// Returns ("", [3]int{-1,-1,-1}) if no winner yet.
func CheckWinner(board [9]string) (string, [3]int) {
    lines := [8][3]int{
        {0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // rows
        {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // cols
        {0, 4, 8}, {2, 4, 6},             // diagonals
    }
    for _, line := range lines {
        a, b, c := line[0], line[1], line[2]
        if board[a] != "" && board[a] == board[b] && board[a] == board[c] {
            return board[a], line
        }
    }
    return "", [3]int{-1, -1, -1}
}

// IsBoardFull returns true when all 9 cells are filled
func IsBoardFull(board [9]string) bool {
    for _, cell := range board {
        if cell == "" {
            return false
        }
    }
    return true
}

// SymbolForUser returns the symbol ("X" or "O") assigned to a userId
func SymbolForUser(state *MatchState, userID string) string {
    for _, p := range state.Players {
        if p.UserID == userID {
            return p.Symbol
        }
    }
    return ""
}

// OtherPlayerID returns the userId of the opponent
func OtherPlayerID(state *MatchState, userID string) string {
    for _, p := range state.Players {
        if p.UserID != userID {
            return p.UserID
        }
    }
    return ""
}