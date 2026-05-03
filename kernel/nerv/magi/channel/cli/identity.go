package cli

import "fmt"

type Identity struct {
	ToolName   string
	WorkingDir string
	Scenario   string
	Delegation *Delegation
}

type Delegation struct {
	UserID string
	Scope  []string
}

func (i *Identity) UserID() string {
	if i.Delegation != nil {
		return i.Delegation.UserID
	}
	return "tool:" + i.ToolName
}

func (i *Identity) DisplayName() string {
	if i.Delegation != nil {
		return fmt.Sprintf("%s (via %s)", i.Delegation.UserID, i.ToolName)
	}
	return fmt.Sprintf("%s @ %s", i.ToolName, i.WorkingDir)
}

type AuthFrame struct {
	Type       string `json:"type"`
	ToolName   string `json:"toolName"`
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
