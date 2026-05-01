package wechat

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const wechatStateDirName = "openclaw-weixin"

// AccountData per-account credential persisted to disk.
type AccountData struct {
	Token   string `json:"token,omitempty"`
	BaseURL string `json:"baseUrl,omitempty"`
	UserID  string `json:"userId,omitempty"`
	SavedAt string `json:"savedAt,omitempty"`
}

func stateDir(baseDir string) string {
	return filepath.Join(baseDir, wechatStateDirName)
}

func accountsDir(baseDir string) string {
	return filepath.Join(stateDir(baseDir), "accounts")
}

func accountPath(baseDir, accountID string) string {
	return filepath.Join(accountsDir(baseDir), accountID+".json")
}

func indexFilePath(baseDir string) string {
	return filepath.Join(stateDir(baseDir), "accounts.json")
}

// ListIndexedAccountIDs returns all registered account IDs.
func ListIndexedAccountIDs(baseDir string) []string {
	path := indexFilePath(baseDir)
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var ids []string
	if err := json.Unmarshal(raw, &ids); err != nil {
		return nil
	}
	filtered := make([]string, 0, len(ids))
	for _, id := range ids {
		if strings.TrimSpace(id) != "" {
			filtered = append(filtered, strings.TrimSpace(id))
		}
	}
	return filtered
}

// RegisterAccountID adds accountID to the persistent index.
func RegisterAccountID(baseDir, accountID string) {
	dir := stateDir(baseDir)
	_ = os.MkdirAll(dir, 0755)

	existing := ListIndexedAccountIDs(baseDir)
	for _, id := range existing {
		if id == accountID {
			return
		}
	}
	updated := append(existing, accountID)
	sort.Strings(updated)
	raw, _ := json.MarshalIndent(updated, "", "  ")
	_ = os.WriteFile(indexFilePath(baseDir), raw, 0644)
}

// UnregisterAccountID removes accountID from the persistent index.
func UnregisterAccountID(baseDir, accountID string) {
	existing := ListIndexedAccountIDs(baseDir)
	updated := make([]string, 0, len(existing))
	for _, id := range existing {
		if id != accountID {
			updated = append(updated, id)
		}
	}
	if len(updated) != len(existing) {
		raw, _ := json.MarshalIndent(updated, "", "  ")
		_ = os.WriteFile(indexFilePath(baseDir), raw, 0644)
	}
}

// LoadAccount reads per-account credential from disk.
func LoadAccount(baseDir, accountID string) *AccountData {
	path := accountPath(baseDir, accountID)
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var data AccountData
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil
	}
	return &data
}

// SaveAccount persists per-account credential to disk.
func SaveAccount(baseDir, accountID string, data *AccountData) {
	dir := accountsDir(baseDir)
	_ = os.MkdirAll(dir, 0755)
	if data.SavedAt == "" {
		data.SavedAt = time.Now().Format(time.RFC3339)
	}
	raw, _ := json.MarshalIndent(data, "", "  ")
	tmp := accountPath(baseDir, accountID) + ".tmp"
	_ = os.WriteFile(tmp, raw, 0600)
	_ = os.Rename(tmp, accountPath(baseDir, accountID))
}

// ClearAccount removes per-account credential file.
func ClearAccount(baseDir, accountID string) {
	p := accountPath(baseDir, accountID)
	_ = os.Remove(p)
}

// ClearStaleAccountsForUserID removes older accounts bound to the same WeChat user.
func ClearStaleAccountsForUserID(baseDir, currentAccountID, userID string) {
	if userID == "" {
		return
	}
	allIDs := ListIndexedAccountIDs(baseDir)
	for _, id := range allIDs {
		if id == currentAccountID {
			continue
		}
		data := LoadAccount(baseDir, id)
		if data != nil && strings.TrimSpace(data.UserID) == userID {
			ClearAccount(baseDir, id)
			UnregisterAccountID(baseDir, id)
		}
	}
}
