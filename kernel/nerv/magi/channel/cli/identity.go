package cli

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

type Identity struct {
	AuthenticatedUser string
	WorkingDir        string
	Scenario          string
}

type Delegation struct {
	UserID string
	Scope  []string
}

func (i *Identity) UserID() string {
	if i.AuthenticatedUser != "" {
		return i.AuthenticatedUser
	}
	return "unknown"
}

func (i *Identity) DisplayName() string {
	if i.AuthenticatedUser != "" {
		return fmt.Sprintf("%s @ %s", i.AuthenticatedUser, i.WorkingDir)
	}
	return fmt.Sprintf("unknown @ %s", i.WorkingDir)
}

type AuthFrame struct {
	Type       string `json:"type"`
	SessionID  string `json:"sessionId"`
	Version    string `json:"version,omitempty"`
	WorkingDir string `json:"workingDir"`
	Scenario   string `json:"scenario"`
	Token      string `json:"token,omitempty"`
}

type AuthResultFrame struct {
	Type    string `json:"type"`
	OK      bool   `json:"ok"`
	Session string `json:"session,omitempty"`
	Error   string `json:"error,omitempty"`
}

type messageFrame struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

func generateShortID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}
