// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package agent

import (
	"errors"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/88250/lute/ast"
	"github.com/siyuan-note/filelock"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func isValidSessionID(id string) bool {
	return ast.IsNodeIDPattern(id)
}

var indexMu sync.Mutex
var taskDirectoryMu sync.Mutex

func taskDirectoriesPath() string {
	// Capability 随当前工作空间持有，存放在 workspace/data 的内核私有区域。
	base := strings.TrimSpace(util.DataDir)
	if base == "" {
		base = strings.TrimSpace(util.WorkspaceDir)
	}
	return filepath.Join(base, ".siyuan", "agent-task-directories.json")
}

func sessionsIndexPath() string {
	return filepath.Join(util.DataDir, "storage", "ai", "agent", "sessions", "index.json")
}

func sessionsDir() string {
	return filepath.Join(util.DataDir, "storage", "ai", "agent", "sessions")
}

type TaskDirectoryPermission string

const (
	TaskDirectoryPermissionReadOnly  TaskDirectoryPermission = "read-only"
	TaskDirectoryPermissionReadWrite TaskDirectoryPermission = "read-write"
	TaskDirectoryPermissionCommand   TaskDirectoryPermission = "command"
)

type TaskDirectoryGrant struct {
	ID              string                  `json:"id"`
	Path            string                  `json:"path"`
	Name            string                  `json:"name"`
	Permission      TaskDirectoryPermission `json:"permission"`
	External        bool                    `json:"external"`
	BoundAt         int64                   `json:"boundAt"`
	OwnerIdentityID string                  `json:"ownerIdentityId"`
}

type TaskDirectoryBinding struct {
	Main        *TaskDirectoryGrant   `json:"main,omitempty"`
	Directories []*TaskDirectoryGrant `json:"directories,omitempty"`

	// Compatibility accessors for the current Agent execution path. They are
	// derived from Main and never serialized into the capability store.
	Path            string `json:"-"`
	Name            string `json:"-"`
	External        bool   `json:"-"`
	BoundAt         int64  `json:"-"`
	OwnerIdentityID string `json:"-"`
}

type taskDirectoryStore struct {
	Version  int                              `json:"version"`
	Bindings map[string]*TaskDirectoryBinding `json:"bindings"`
}

func loadTaskDirectoryStoreLocked() (*taskDirectoryStore, error) {
	store := &taskDirectoryStore{Version: 2, Bindings: map[string]*TaskDirectoryBinding{}}
	data, err := os.ReadFile(taskDirectoriesPath())
	if os.IsNotExist(err) {
		return store, nil
	}
	if err != nil {
		return nil, err
	}
	if err = gulu.JSON.UnmarshalJSON(data, store); err != nil {
		return nil, fmt.Errorf("decode task directory bindings: %w", err)
	}
	if store.Version != 2 {
		return nil, fmt.Errorf("unsupported task directory binding version %d", store.Version)
	}
	if store.Bindings == nil {
		return nil, fmt.Errorf("decode task directory bindings: missing bindings")
	}
	for id, binding := range store.Bindings {
		if binding == nil || !normalizeTaskDirectoryBinding(binding) {
			return nil, fmt.Errorf("decode task directory bindings: invalid binding %s", id)
		}
	}
	return store, nil
}

func saveTaskDirectoryStoreLocked(store *taskDirectoryStore) error {
	data, err := gulu.JSON.MarshalIndentJSON(store, "", "\t")
	if err != nil {
		return err
	}
	path := taskDirectoriesPath()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	if err := filelock.WriteFile(path, data); err != nil {
		return err
	}
	return os.Chmod(path, 0600)
}

type SessionIndexItem struct {
	ID            string                `json:"id"`
	Title         string                `json:"title"`
	TargetKind    string                `json:"targetKind,omitempty"`
	CreatedAt     int64                 `json:"createdAt"`
	UpdatedAt     int64                 `json:"updatedAt"`
	TaskDirectory *TaskDirectoryBinding `json:"taskDirectory,omitempty"`
}

type SessionListResult struct {
	Sessions []*SessionIndexItem `json:"sessions"`
	Total    int                 `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
}

type sessionMeta struct {
	ID                  string `json:"id"`
	Title               string `json:"title"`
	TargetKind          string `json:"targetKind,omitempty"`
	CreatedAt           int64  `json:"createdAt"`
	UpdatedAt           int64  `json:"updatedAt"`
	Revision            int64  `json:"revision"`
	ExpectedRevision    *int64 `json:"expectedRevision,omitempty"`
	CommitTurnID        string `json:"commitTurnID,omitempty"`
	RecoveryTurnID      string `json:"recoveryTurnID,omitempty"`
	LastCommittedTurnID string `json:"lastCommittedTurnID,omitempty"`
}

var ErrSessionConflict = errors.New("agent session revision conflict")
var ErrRuntimeNotFinalized = errors.New("agent runtime turn is not finalized")

var sessionLocks sync.Map

func sessionLock(id string) *sync.Mutex {
	lock, _ := sessionLocks.LoadOrStore(id, &sync.Mutex{})
	return lock.(*sync.Mutex)
}

func loadSessionIndex() map[string]*SessionIndexItem {
	data, err := os.ReadFile(sessionsIndexPath())
	if err != nil {
		return nil
	}
	var records map[string]sessionIndexRecord
	if gulu.JSON.UnmarshalJSON(data, &records) != nil {
		return nil
	}
	index := make(map[string]*SessionIndexItem, len(records))
	for id, record := range records {
		index[id] = &SessionIndexItem{
			ID: record.ID, Title: record.Title, TargetKind: normalizeSessionTargetKind(record.TargetKind),
			CreatedAt: record.CreatedAt, UpdatedAt: record.UpdatedAt,
		}
	}
	return index
}

type sessionIndexRecord struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	TargetKind string `json:"targetKind,omitempty"`
	CreatedAt  int64  `json:"createdAt"`
	UpdatedAt  int64  `json:"updatedAt"`
}

func saveSessionIndex(index map[string]*SessionIndexItem) {
	records := make(map[string]sessionIndexRecord, len(index))
	for id, item := range index {
		if item == nil {
			continue
		}
		records[id] = sessionIndexRecord{
			ID: item.ID, Title: item.Title, TargetKind: normalizeSessionTargetKind(item.TargetKind),
			CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
		}
	}
	data, err := gulu.JSON.MarshalIndentJSON(records, "", "\t")
	if err != nil {
		return
	}
	_ = os.MkdirAll(filepath.Dir(sessionsIndexPath()), 0755)
	if err := filelock.WriteFile(sessionsIndexPath(), data); err != nil {
		logging.LogErrorf("save session index failed: %s", err)
	}
}

func rebuildSessionIndex() map[string]*SessionIndexItem {
	entries, err := os.ReadDir(sessionsDir())
	if err != nil {
		return nil
	}
	index := map[string]*SessionIndexItem{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		id := entry.Name()
		sessionPath := filepath.Join(sessionsDir(), id, "session.json")
		sessionData, err := os.ReadFile(sessionPath)
		if err != nil {
			continue
		}
		var meta sessionMeta
		if gulu.JSON.UnmarshalJSON(sessionData, &meta) != nil || meta.ID == "" {
			continue
		}
		title := meta.Title
		if title == "" {
			title = "AI Agent"
		}
		index[id] = &SessionIndexItem{
			ID:         meta.ID,
			Title:      title,
			TargetKind: normalizeSessionTargetKind(meta.TargetKind),
			CreatedAt:  meta.CreatedAt,
			UpdatedAt:  meta.UpdatedAt,
		}
	}
	saveSessionIndex(index)
	return index
}

func cloneTaskDirectoryGrant(grant *TaskDirectoryGrant) *TaskDirectoryGrant {
	if grant == nil {
		return nil
	}
	copy := *grant
	return &copy
}

func normalizeTaskDirectoryBinding(binding *TaskDirectoryBinding) bool {
	if binding == nil {
		return false
	}
	if binding.Main == nil && len(binding.Directories) == 0 {
		return false
	}
	if binding.Main != nil {
		if binding.Main.ID == "" || binding.Main.Path == "" || binding.Main.OwnerIdentityID == "" || binding.Main.Permission != TaskDirectoryPermissionReadWrite {
			return false
		}
		binding.Path = binding.Main.Path
		binding.Name = binding.Main.Name
		binding.External = binding.Main.External
		binding.BoundAt = binding.Main.BoundAt
		binding.OwnerIdentityID = binding.Main.OwnerIdentityID
	} else {
		first := binding.Directories[0]
		if first == nil || first.Path == "" || first.OwnerIdentityID == "" {
			return false
		}
		binding.OwnerIdentityID = first.OwnerIdentityID
	}
	for _, grant := range binding.Directories {
		if grant == nil || grant.ID == "" || grant.Path == "" || grant.OwnerIdentityID == "" || !validTaskDirectoryPermission(grant.Permission) {
			return false
		}
		if binding.OwnerIdentityID != grant.OwnerIdentityID {
			return false
		}
	}
	return true
}

func cloneTaskDirectoryBinding(binding *TaskDirectoryBinding) *TaskDirectoryBinding {
	if binding == nil {
		return nil
	}
	copy := &TaskDirectoryBinding{
		Main:            cloneTaskDirectoryGrant(binding.Main),
		Directories:     make([]*TaskDirectoryGrant, 0, len(binding.Directories)),
		Path:            binding.Path,
		Name:            binding.Name,
		External:        binding.External,
		BoundAt:         binding.BoundAt,
		OwnerIdentityID: binding.OwnerIdentityID,
	}
	for _, grant := range binding.Directories {
		copy.Directories = append(copy.Directories, cloneTaskDirectoryGrant(grant))
	}
	normalizeTaskDirectoryBinding(copy)
	return copy
}

func (binding *TaskDirectoryBinding) Redacted() *TaskDirectoryBinding {
	copy := cloneTaskDirectoryBinding(binding)
	if copy == nil {
		return nil
	}
	redact := func(grant *TaskDirectoryGrant) {
		if grant == nil {
			return
		}
		grant.Path = ""
		grant.OwnerIdentityID = ""
	}
	redact(copy.Main)
	for _, grant := range copy.Directories {
		redact(grant)
	}
	copy.Path = ""
	copy.OwnerIdentityID = ""
	return copy
}

func validTaskDirectoryPermission(permission TaskDirectoryPermission) bool {
	switch permission {
	case TaskDirectoryPermissionReadOnly, TaskDirectoryPermissionReadWrite, TaskDirectoryPermissionCommand:
		return true
	default:
		return false
	}
}

func taskDirectoryBindingOwner(binding *TaskDirectoryBinding) string {
	if binding == nil {
		return ""
	}
	if binding.OwnerIdentityID != "" {
		return strings.TrimSpace(binding.OwnerIdentityID)
	}
	if binding.Main != nil {
		return strings.TrimSpace(binding.Main.OwnerIdentityID)
	}
	for _, grant := range binding.Directories {
		if grant != nil {
			return strings.TrimSpace(grant.OwnerIdentityID)
		}
	}
	return ""
}

func subtleOwnerEqual(left, right string) bool {
	return strings.TrimSpace(left) != "" && strings.TrimSpace(left) == strings.TrimSpace(right)
}

func (binding *TaskDirectoryBinding) Grant(id string) *TaskDirectoryGrant {
	if binding == nil {
		return nil
	}
	id = strings.TrimSpace(id)
	if id == "" || id == "main" {
		if binding.Main == nil && binding.Path != "" {
			return &TaskDirectoryGrant{ID: "main", Path: binding.Path, Name: binding.Name, Permission: TaskDirectoryPermissionReadWrite, External: binding.External, BoundAt: binding.BoundAt, OwnerIdentityID: binding.OwnerIdentityID}
		}
		return cloneTaskDirectoryGrant(binding.Main)
	}
	for _, grant := range binding.Directories {
		if grant != nil && grant.ID == id {
			return cloneTaskDirectoryGrant(grant)
		}
	}
	return nil
}

func (binding *TaskDirectoryBinding) HasExternal() bool {
	if binding == nil {
		return false
	}
	if binding.Main != nil && binding.Main.External {
		return true
	}
	if binding.Main == nil && len(binding.Directories) == 0 && binding.External && binding.Path != "" {
		return true
	}
	for _, grant := range binding.Directories {
		if grant != nil && grant.External {
			return true
		}
	}
	return false
}

func RedactSessionList(result *SessionListResult) *SessionListResult {
	if result == nil {
		return nil
	}
	copy := *result
	copy.Sessions = make([]*SessionIndexItem, 0, len(result.Sessions))
	for _, item := range result.Sessions {
		if item == nil {
			continue
		}
		itemCopy := *item
		itemCopy.TaskDirectory = item.TaskDirectory.Redacted()
		copy.Sessions = append(copy.Sessions, &itemCopy)
	}
	return &copy
}

func taskDirectoryBindingsSnapshot() (map[string]*TaskDirectoryBinding, error) {
	taskDirectoryMu.Lock()
	defer taskDirectoryMu.Unlock()
	store, err := loadTaskDirectoryStoreLocked()
	if err != nil {
		return nil, err
	}
	bindings := make(map[string]*TaskDirectoryBinding, len(store.Bindings))
	for id, binding := range store.Bindings {
		if err := validateTaskDirectoryBinding(binding); err != nil {
			return nil, fmt.Errorf("validate task directory binding %s: %w", id, err)
		}
		bindings[id] = cloneTaskDirectoryBinding(binding)
	}
	return bindings, nil
}

func validateTaskDirectoryGrant(grant *TaskDirectoryGrant) error {
	if grant == nil || grant.Path == "" || grant.OwnerIdentityID == "" || !validTaskDirectoryPermission(grant.Permission) {
		return fmt.Errorf("invalid directory grant")
	}
	root := filepath.Clean(grant.Path)
	resolved, err := filepath.EvalSymlinks(root)
	if err != nil {
		return fmt.Errorf("directory is unavailable")
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("directory is unavailable")
	}
	if !samePath(root, resolved) {
		return fmt.Errorf("directory path changed through symlink")
	}
	workspaceRoot, err := filepath.EvalSymlinks(filepath.Clean(util.WorkspaceDir))
	if err != nil {
		workspaceRoot = filepath.Clean(util.WorkspaceDir)
	}
	if !grant.External || gulu.File.IsSubPath(workspaceRoot, resolved) || samePath(workspaceRoot, resolved) {
		return fmt.Errorf("directory must remain outside the SiYuan workspace")
	}
	return nil
}

func validateTaskDirectoryBinding(binding *TaskDirectoryBinding) error {
	if !normalizeTaskDirectoryBinding(binding) {
		return fmt.Errorf("invalid binding")
	}
	if binding.Main != nil {
		if err := validateTaskDirectoryGrant(binding.Main); err != nil {
			return err
		}
	}
	seen := map[string]bool{}
	for _, grant := range binding.Directories {
		if seen[grant.ID] {
			return fmt.Errorf("duplicate directory grant id")
		}
		seen[grant.ID] = true
		if err := validateTaskDirectoryGrant(grant); err != nil {
			return err
		}
		if binding.Main != nil && samePath(binding.Main.Path, grant.Path) {
			return fmt.Errorf("directory is already bound as main")
		}
	}
	return nil
}

func normalizeSessionTargetKind(targetKind string) string {
	if targetKind == "magi" {
		return targetKind
	}
	return "native-agent"
}

func UpdateSessionIndex(id, title, targetKind string, createdAt, updatedAt int64) {
	if id == "" {
		return
	}
	indexMu.Lock()
	defer indexMu.Unlock()

	index := loadSessionIndex()
	if index == nil {
		index = map[string]*SessionIndexItem{}
	}
	if title == "" {
		title = "AI Agent"
	}
	index[id] = &SessionIndexItem{
		ID:         id,
		Title:      title,
		TargetKind: normalizeSessionTargetKind(targetKind),
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}
	saveSessionIndex(index)
}

func ListSessions(page, pageSize int, keyword, ownerIdentityID, targetKind string) (*SessionListResult, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 30
	}

	indexMu.Lock()
	index := loadSessionIndex()
	if index == nil || len(index) == 0 {
		index = rebuildSessionIndex()
	}
	if index == nil {
		indexMu.Unlock()
		return &SessionListResult{
			Sessions: []*SessionIndexItem{},
			Total:    0,
			Page:     page,
			PageSize: pageSize,
		}, nil
	}
	snapshot := make(map[string]*SessionIndexItem, len(index))
	maps.Copy(snapshot, index)
	indexMu.Unlock()

	entries, err := os.ReadDir(sessionsDir())
	if err == nil {
		dirMap := map[string]bool{}
		for _, entry := range entries {
			if entry.IsDir() {
				dirMap[entry.Name()] = true
			}
		}

		needsSave := false

		for id := range snapshot {
			if !dirMap[id] {
				delete(snapshot, id)
				needsSave = true
			}
		}

		for id := range dirMap {
			if _, ok := snapshot[id]; !ok {
				sessionPath := filepath.Join(sessionsDir(), id, "session.json")
				sessionData, err := os.ReadFile(sessionPath)
				if err == nil {
					var meta sessionMeta
					if gulu.JSON.UnmarshalJSON(sessionData, &meta) == nil && meta.ID != "" {
						title := meta.Title
						if title == "" {
							title = "AI Agent"
						}
						snapshot[id] = &SessionIndexItem{
							ID:         meta.ID,
							Title:      title,
							TargetKind: normalizeSessionTargetKind(meta.TargetKind),
							CreatedAt:  meta.CreatedAt,
							UpdatedAt:  meta.UpdatedAt,
						}
						needsSave = true
					}
				}
			}
		}

		if needsSave {
			indexMu.Lock()
			saveSessionIndex(snapshot)
			indexMu.Unlock()
		}
	}

	index = snapshot
	bindings, err := taskDirectoryBindingsSnapshot()
	if err != nil {
		return nil, err
	}

	items := make([]*SessionIndexItem, 0, len(index))
	targetKind = normalizeSessionTargetKind(targetKind)
	for _, item := range index {
		itemCopy := *item
		itemCopy.TargetKind = normalizeSessionTargetKind(itemCopy.TargetKind)
		if itemCopy.TargetKind != targetKind {
			continue
		}
		itemCopy.TaskDirectory = cloneTaskDirectoryBinding(bindings[item.ID])
		if itemCopy.TaskDirectory != nil && ownerIdentityID != "" && !subtleOwnerEqual(taskDirectoryBindingOwner(itemCopy.TaskDirectory), ownerIdentityID) {
			continue
		}
		if itemCopy.TaskDirectory != nil && ownerIdentityID == "" {
			continue
		}
		if keyword != "" {
			kw := strings.ToLower(keyword)
			title := strings.ToLower(item.Title)
			if !strings.Contains(title, kw) {
				continue
			}
		}
		items = append(items, &itemCopy)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt > items[j].CreatedAt
	})

	total := len(items)

	start := (page - 1) * pageSize
	if start >= total {
		return &SessionListResult{
			Sessions: []*SessionIndexItem{},
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		}, nil
	}
	end := min(start+pageSize, total)

	return &SessionListResult{
		Sessions: items[start:end],
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func GetSession(id string) (map[string]any, error) {
	return GetSessionState(id, true)
}

func GetSessionState(id string, includeRuntime bool) (map[string]any, error) {
	if id == "" || !isValidSessionID(id) {
		return nil, fmt.Errorf("invalid session id")
	}
	lock := sessionLock(id)
	lock.Lock()
	defer lock.Unlock()

	sessionPath := filepath.Join(sessionsDir(), id, "session.json")
	data, err := os.ReadFile(sessionPath)
	if err != nil {
		return nil, err
	}
	var session map[string]any
	if err := gulu.JSON.UnmarshalJSON(data, &session); err != nil {
		return nil, err
	}
	if includeRuntime {
		if err := mergeRuntimeIntoSessionLocked(id, session); err != nil {
			return nil, err
		}
	}
	return session, nil
}

func GetTaskDirectoryBinding(id string) (*TaskDirectoryBinding, error) {
	if id == "" || !isValidSessionID(id) {
		return nil, nil
	}
	taskDirectoryMu.Lock()
	defer taskDirectoryMu.Unlock()
	store, err := loadTaskDirectoryStoreLocked()
	if err != nil {
		return nil, err
	}
	binding := cloneTaskDirectoryBinding(store.Bindings[id])
	if binding == nil {
		return nil, nil
	}
	if err := validateTaskDirectoryBinding(binding); err != nil {
		return nil, err
	}
	return binding, nil
}

func SessionExists(id string) bool {
	if id == "" || !isValidSessionID(id) {
		return false
	}
	info, err := os.Stat(filepath.Join(sessionsDir(), id, "session.json"))
	return err == nil && !info.IsDir()
}

func resolveTaskDirectoryGrant(rawPath string, permission TaskDirectoryPermission, ownerIdentityID string) (*TaskDirectoryGrant, error) {
	if !validTaskDirectoryPermission(permission) {
		return nil, fmt.Errorf("invalid task directory permission")
	}
	root, err := filepath.Abs(strings.TrimSpace(rawPath))
	if err != nil {
		return nil, fmt.Errorf("resolve task directory: %w", err)
	}
	root = filepath.Clean(root)
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return nil, fmt.Errorf("task directory is not a readable directory")
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return nil, fmt.Errorf("resolve task directory links: %w", err)
	}
	workspaceRoot, err := filepath.EvalSymlinks(filepath.Clean(util.WorkspaceDir))
	if err != nil {
		workspaceRoot = filepath.Clean(util.WorkspaceDir)
	}
	if gulu.File.IsSubPath(workspaceRoot, resolvedRoot) || samePath(workspaceRoot, resolvedRoot) {
		return nil, fmt.Errorf("task directory must be outside the SiYuan workspace")
	}
	ownerIdentityID = strings.TrimSpace(ownerIdentityID)
	if ownerIdentityID == "" {
		return nil, fmt.Errorf("verified owner identity is required")
	}
	return &TaskDirectoryGrant{
		Path:            resolvedRoot,
		Name:            filepath.Base(resolvedRoot),
		Permission:      permission,
		External:        true,
		BoundAt:         time.Now().UnixMilli(),
		OwnerIdentityID: ownerIdentityID,
	}, nil
}

func BindTaskDirectory(id, rawPath, ownerIdentityID string) (*TaskDirectoryBinding, error) {
	return bindTaskDirectoryGrant(id, rawPath, TaskDirectoryPermissionReadWrite, ownerIdentityID, true)
}

func AddTaskDirectory(id, rawPath string, permission TaskDirectoryPermission, ownerIdentityID string) (*TaskDirectoryBinding, error) {
	if permission == TaskDirectoryPermissionReadWrite || permission == TaskDirectoryPermissionReadOnly || permission == TaskDirectoryPermissionCommand {
		return bindTaskDirectoryGrant(id, rawPath, permission, ownerIdentityID, false)
	}
	return nil, fmt.Errorf("invalid task directory permission")
}

func bindTaskDirectoryGrant(id, rawPath string, permission TaskDirectoryPermission, ownerIdentityID string, main bool) (*TaskDirectoryBinding, error) {
	if id == "" || !isValidSessionID(id) {
		return nil, fmt.Errorf("invalid session id")
	}
	if !SessionExists(id) {
		return nil, fmt.Errorf("agent session does not exist")
	}
	grant, err := resolveTaskDirectoryGrant(rawPath, permission, ownerIdentityID)
	if err != nil {
		return nil, err
	}
	taskDirectoryMu.Lock()
	defer taskDirectoryMu.Unlock()
	store, err := loadTaskDirectoryStoreLocked()
	if err != nil {
		return nil, err
	}
	binding := cloneTaskDirectoryBinding(store.Bindings[id])
	if binding == nil {
		binding = &TaskDirectoryBinding{}
	}
	if !main && binding.Main == nil {
		return nil, fmt.Errorf("main task directory must be bound before adding additional directories")
	}
	owner := taskDirectoryBindingOwner(binding)
	if owner != "" && !subtleOwnerEqual(owner, ownerIdentityID) {
		return nil, fmt.Errorf("task directory binding belongs to another owner")
	}
	grant.ID = "main"
	if !main {
		grant.ID = ast.NewNodeID()
	}
	if main {
		binding.Main = grant
	} else {
		for _, existing := range binding.Directories {
			if existing != nil && samePath(existing.Path, grant.Path) {
				return nil, fmt.Errorf("task directory is already bound")
			}
		}
		binding.Directories = append(binding.Directories, grant)
	}
	if !normalizeTaskDirectoryBinding(binding) {
		return nil, fmt.Errorf("invalid task directory binding")
	}
	if err := validateTaskDirectoryBinding(binding); err != nil {
		return nil, err
	}
	store.Bindings[id] = cloneTaskDirectoryBinding(binding)
	if err := saveTaskDirectoryStoreLocked(store); err != nil {
		return nil, err
	}
	return cloneTaskDirectoryBinding(binding), nil
}

func UnbindTaskDirectory(id string, directoryID ...string) error {
	if id == "" || !isValidSessionID(id) {
		return fmt.Errorf("invalid session id")
	}
	taskDirectoryMu.Lock()
	defer taskDirectoryMu.Unlock()
	store, err := loadTaskDirectoryStoreLocked()
	if err != nil {
		return err
	}
	binding := cloneTaskDirectoryBinding(store.Bindings[id])
	if binding == nil {
		return saveTaskDirectoryStoreLocked(store)
	}
	grantID := ""
	if len(directoryID) > 0 {
		grantID = strings.TrimSpace(directoryID[0])
	}
	if grantID == "" || grantID == "main" {
		if len(binding.Directories) > 0 {
			return fmt.Errorf("additional task directories must be removed before the main directory")
		}
		binding.Main = nil
	} else {
		filtered := binding.Directories[:0]
		for _, grant := range binding.Directories {
			if grant == nil || grant.ID != grantID {
				filtered = append(filtered, grant)
			}
		}
		binding.Directories = filtered
	}
	if binding.Main == nil && len(binding.Directories) == 0 {
		delete(store.Bindings, id)
	} else {
		if !normalizeTaskDirectoryBinding(binding) {
			return fmt.Errorf("invalid task directory binding")
		}
		store.Bindings[id] = binding
	}
	return saveTaskDirectoryStoreLocked(store)
}

func samePath(left, right string) bool {
	if runtime.GOOS == "windows" {
		return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
	}
	return filepath.Clean(left) == filepath.Clean(right)
}

func SaveSession(data []byte) (int64, error) {
	revision, _, err := SaveSessionState(data)
	return revision, err
}

func SaveSessionState(data []byte) (int64, map[string]any, error) {
	var meta sessionMeta
	if err := gulu.JSON.UnmarshalJSON(data, &meta); err != nil || meta.ID == "" || !isValidSessionID(meta.ID) {
		return 0, nil, fmt.Errorf("invalid session data")
	}
	lock := sessionLock(meta.ID)
	lock.Lock()
	defer lock.Unlock()

	dir := filepath.Join(sessionsDir(), meta.ID)
	path := filepath.Join(dir, "session.json")

	var newData map[string]any
	if err := gulu.JSON.UnmarshalJSON(data, &newData); err != nil {
		return 0, nil, fmt.Errorf("decode session data failed: %w", err)
	}
	delete(newData, "expectedRevision")
	delete(newData, "commitTurnID")
	delete(newData, "recoveryTurnID")
	delete(newData, "recoveryState")
	delete(newData, "recoveryRevision")
	delete(newData, "agentRunning")
	delete(newData, "lastCommittedTurnID")
	delete(newData, "taskDirectory")
	// promptSource 是 Kernel 持有的系统提示词快照。普通会话保存只能保留它，
	// 不能让旧页面、跨实例快照或直接请求替换正文与版本指纹。
	delete(newData, "promptSource")
	commitTurnID := meta.CommitTurnID
	if commitTurnID == "" {
		commitTurnID = meta.RecoveryTurnID
	}

	currentRevision := int64(0)
	currentCommittedTurnID := ""
	existing, err := os.ReadFile(path)
	if err == nil && len(existing) > 0 {
		var existingData map[string]any
		if err := gulu.JSON.UnmarshalJSON(existing, &existingData); err != nil {
			return 0, nil, fmt.Errorf("decode existing session data failed: %w", err)
		} else {
			currentRevision = numberToInt64(existingData["revision"])
			currentCommittedTurnID, _ = existingData["lastCommittedTurnID"].(string)
			serverPromptSource, hasServerPromptSource := existingData["promptSource"]
			if commitTurnID != "" && currentCommittedTurnID == commitTurnID {
				// 提交响应丢失后，客户端可能原样重试同一个 commitTurnID。此判断要先于修订号校验，
				// 并且不能再用客户端快照覆盖已经由 runtime 生成的权威内容。
				if err := markRuntimeCommittedLocked(meta.ID, commitTurnID); err != nil {
					logging.LogWarnf("clean committed agent runtime failed: %s", err)
				}
				return currentRevision, existingData, nil
			}
			if meta.ExpectedRevision != nil && *meta.ExpectedRevision != currentRevision {
				return currentRevision, nil, ErrSessionConflict
			}
			for k, v := range existingData {
				if _, ok := newData[k]; !ok {
					// messages 是已废弃的旧会话字段，不再带入新格式；其他未知字段原样保留，
					// 避免前后端版本不一致时擦除较新版本写入的数据。
					if k != "messages" && k != "taskDirectory" && k != "promptSource" && k != "expectedRevision" && k != "commitTurnID" &&
						k != "recoveryTurnID" && k != "recoveryState" && k != "recoveryRevision" && k != "agentRunning" {
						newData[k] = v
					}
				}
			}
			if hasServerPromptSource {
				newData["promptSource"] = serverPromptSource
			}
		}
	} else if err != nil && !os.IsNotExist(err) {
		return 0, nil, fmt.Errorf("read session file failed: %w", err)
	} else if meta.ExpectedRevision != nil && *meta.ExpectedRevision != 0 {
		return 0, nil, ErrSessionConflict
	}
	if commitTurnID != "" {
		runtime, err := loadRuntimeLocked(meta.ID)
		if err != nil {
			return currentRevision, nil, fmt.Errorf("read agent runtime failed: %w", err)
		}
		if runtime.ActiveTurn != nil {
			if runtime.ActiveTurn.TurnID != commitTurnID {
				return currentRevision, nil, ErrSessionConflict
			}
			if !isRuntimeTurnTerminal(runtime.ActiveTurn) {
				return currentRevision, nil, ErrRuntimeNotFinalized
			}
			if err := applyRuntimeTurnToSessionLocked(newData, runtime.ActiveTurn); err != nil {
				return currentRevision, nil, err
			}
		} else if currentCommittedTurnID != commitTurnID {
			return currentRevision, nil, ErrSessionConflict
		}
	}

	newRevision := currentRevision + 1
	newData["revision"] = newRevision
	if commitTurnID != "" {
		newData["lastCommittedTurnID"] = commitTurnID
	}
	data, err = gulu.JSON.MarshalIndentJSON(newData, "", "\t")
	if err != nil {
		return currentRevision, nil, fmt.Errorf("encode session data failed: %w", err)
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return currentRevision, nil, fmt.Errorf("create session dir failed: %w", err)
	}
	if err := filelock.WriteFile(path, data); err != nil {
		return currentRevision, nil, fmt.Errorf("save session file failed: %w", err)
	}
	if commitTurnID != "" {
		if err := markRuntimeCommittedLocked(meta.ID, commitTurnID); err != nil {
			logging.LogWarnf("commit agent runtime failed: %s", err)
		}
	}

	title, _ := newData["title"].(string)
	if title == "" {
		title = "AI Agent"
	}
	createdAt := meta.CreatedAt
	if value := numberToInt64(newData["createdAt"]); value > 0 {
		createdAt = value
	}
	updatedAt := meta.UpdatedAt
	if value := numberToInt64(newData["updatedAt"]); value > 0 {
		updatedAt = value
	}
	targetKind, _ := newData["targetKind"].(string)
	UpdateSessionIndex(meta.ID, title, targetKind, createdAt, updatedAt)

	return newRevision, newData, nil
}

func DeleteSession(id string) error {
	if id == "" || !isValidSessionID(id) {
		return fmt.Errorf("invalid session id")
	}
	lock := sessionLock(id)
	lock.Lock()
	defer lock.Unlock()

	taskDirectoryMu.Lock()
	store, err := loadTaskDirectoryStoreLocked()
	if err != nil {
		taskDirectoryMu.Unlock()
		return fmt.Errorf("load task directory bindings for removal: %w", err)
	}
	delete(store.Bindings, id)
	err = saveTaskDirectoryStoreLocked(store)
	taskDirectoryMu.Unlock()
	if err != nil {
		return fmt.Errorf("remove task directory binding: %w", err)
	}

	dir := filepath.Join(sessionsDir(), id)
	if err := os.RemoveAll(dir); err != nil {
		return err
	}

	indexMu.Lock()
	index := loadSessionIndex()
	if index != nil {
		delete(index, id)
		saveSessionIndex(index)
	}
	indexMu.Unlock()

	return nil
}

func numberToInt64(value any) int64 {
	switch v := value.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	case jsonNumber:
		parsed, _ := v.Int64()
		return parsed
	}
	return 0
}

// jsonNumber 保持与 encoding/json.Number 相同的最小接口，避免会话存储依赖具体解码器实现。
type jsonNumber interface {
	Int64() (int64, error)
}
