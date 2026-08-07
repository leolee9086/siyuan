package filebrowser

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var (
	ErrRootNotFound       = errors.New("file browser root not found")
	ErrRootUnavailable    = errors.New("file browser root is unavailable")
	ErrPathTraversal      = errors.New("file browser path escapes root")
	ErrPathNotFound       = errors.New("file browser path not found")
	ErrNotDirectory       = errors.New("file browser path is not a directory")
	ErrNotFile            = errors.New("file browser path is not a file")
	ErrPreviewUnsupported = errors.New("file browser preview is not text")
	ErrPropertiesEmpty    = errors.New("file browser property request is empty")
	ErrPropertiesTooLarge = errors.New("file browser property request exceeds 100 items")
)

// BindingProvider supplies all persisted task-directory bindings.
type BindingProvider func() (map[string]*agent.TaskDirectoryBinding, error)

// Service owns root aggregation and path-safe directory listing.
type Service struct {
	workspacePath string
	bindings      BindingProvider
}

// NewService creates a browser service. A nil provider reads the persisted Agent store.
func NewService(workspacePath string, provider BindingProvider) *Service {
	if strings.TrimSpace(workspacePath) == "" {
		workspacePath = util.WorkspaceDir
	}
	if provider == nil {
		provider = agent.ListTaskDirectoryBindings
	}
	return &Service{workspacePath: filepath.Clean(workspacePath), bindings: provider}
}

// ListRoots returns the workspace root followed by all unique bound directories.
// Missing bindings remain visible so users can repair or unbind them explicitly.
func (s *Service) ListRoots() ([]Root, error) {
	workspace, err := absoluteCleanPath(s.workspacePath)
	if err != nil {
		return nil, err
	}
	workspaceResolved, workspaceExists := resolveDirectory(workspace)
	workspaceKey := pathKey(workspaceResolved)
	rootMap := map[string]*Root{}
	rootPaths := map[string]string{}
	workspaceRoot := &Root{
		ID:           "workspace",
		Kind:         RootKindWorkspace,
		Label:        filepath.Base(workspace),
		Path:         workspaceResolved,
		Permission:   "read-write",
		Capabilities: RootCapabilities{Browse: true, Write: true},
		Exists:       workspaceExists,
	}
	if workspaceRoot.Label == "" || workspaceRoot.Label == string(filepath.Separator) {
		workspaceRoot.Label = workspace
	}
	rootMap[workspaceKey] = workspaceRoot
	rootPaths[workspaceKey] = workspaceResolved

	bindings, err := s.bindings()
	if err != nil {
		return nil, err
	}
	for sessionID, binding := range bindings {
		if binding == nil {
			continue
		}
		grants := make([]*agent.TaskDirectoryGrant, 0, len(binding.Directories)+1)
		if binding.Main != nil {
			grants = append(grants, binding.Main)
		}
		grants = append(grants, binding.Directories...)
		for _, grant := range grants {
			if grant == nil || strings.TrimSpace(grant.Path) == "" {
				continue
			}
			path, pathExists := normalizeBoundPath(grant.Path)
			key := pathKey(path)
			root := rootMap[key]
			if root == nil {
				root = &Root{
					ID:     makeRootID(path),
					Kind:   RootKindAgent,
					Label:  grant.Name,
					Path:   path,
					Exists: pathExists,
				}
				if strings.TrimSpace(root.Label) == "" {
					root.Label = filepath.Base(path)
				}
				rootMap[key] = root
				rootPaths[key] = path
			}
			root.Sources = append(root.Sources, RootSource{
				SessionID: sessionID, DirectoryID: grant.ID, Name: grant.Name,
				Permission: string(grant.Permission), External: grant.External, BoundAt: grant.BoundAt,
			})
			root.Capabilities.Browse = true
			if grant.Permission == agent.TaskDirectoryPermissionReadWrite {
				root.Capabilities.Write = true
			}
			if grant.Permission == agent.TaskDirectoryPermissionCommand {
				root.Capabilities.Command = true
			}
		}
	}

	roots := make([]Root, 0, len(rootMap))
	for key, root := range rootMap {
		root.Path = rootPaths[key]
		root.Permission = aggregatePermission(root)
		sort.Slice(root.Sources, func(i, j int) bool {
			if root.Sources[i].SessionID != root.Sources[j].SessionID {
				return root.Sources[i].SessionID < root.Sources[j].SessionID
			}
			return root.Sources[i].DirectoryID < root.Sources[j].DirectoryID
		})
		roots = append(roots, *root)
	}
	sort.SliceStable(roots, func(i, j int) bool {
		if roots[i].Kind != roots[j].Kind {
			return roots[i].Kind == RootKindWorkspace
		}
		return pathKey(roots[i].Path) < pathKey(roots[j].Path)
	})
	return roots, nil
}

func aggregatePermission(root *Root) string {
	if root.Kind == RootKindWorkspace || root.Capabilities.Write {
		return "read-write"
	}
	if root.Capabilities.Command {
		return "command"
	}
	return "read-only"
}

func makeRootID(path string) string {
	sum := sha256.Sum256([]byte(pathKey(path)))
	return "root-" + hex.EncodeToString(sum[:8])
}

func absoluteCleanPath(raw string) (string, error) {
	path := strings.TrimSpace(raw)
	if path == "" {
		return "", ErrRootUnavailable
	}
	abs, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}

func normalizeBoundPath(raw string) (string, bool) {
	path, err := absoluteCleanPath(raw)
	if err != nil {
		return filepath.Clean(raw), false
	}
	if resolved, ok := resolveDirectory(path); ok {
		return resolved, true
	}
	return path, false
}

func resolveDirectory(path string) (string, bool) {
	resolved, err := resolvePathTarget(path)
	if err != nil {
		info, statErr := os.Stat(path)
		return path, statErr == nil && info.IsDir()
	}
	info, err := os.Stat(resolved)
	return filepath.Clean(resolved), err == nil && info.IsDir()
}

func pathKey(path string) string {
	path = filepath.Clean(path)
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		return strings.ToLower(path)
	}
	return path
}

func sameOrWithin(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil || filepath.IsAbs(rel) {
		return false
	}
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		rel = strings.ToLower(rel)
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func (s *Service) rootByID(id string) (Root, error) {
	roots, err := s.ListRoots()
	if err != nil {
		return Root{}, err
	}
	for _, root := range roots {
		if root.ID == id {
			return root, nil
		}
	}
	return Root{}, ErrRootNotFound
}

func (s *Service) resolveExistingPath(root Root, relative string) (string, string, os.FileInfo, error) {
	if !root.Exists {
		return "", "", nil, ErrRootUnavailable
	}
	relative, err := normalizeRelativePath(relative)
	if err != nil {
		return "", "", nil, err
	}
	rootPath, rootOK := resolveDirectory(root.Path)
	if !rootOK {
		return "", "", nil, ErrRootUnavailable
	}
	candidate := filepath.Join(rootPath, filepath.FromSlash(relative))
	cleanCandidate := filepath.Clean(candidate)
	if !sameOrWithin(rootPath, cleanCandidate) {
		return "", "", nil, ErrPathTraversal
	}
	resolved, err := resolvePathTarget(cleanCandidate)
	if err != nil {
		if os.IsNotExist(err) {
			return "", "", nil, ErrPathNotFound
		}
		return "", "", nil, err
	}
	resolved = filepath.Clean(resolved)
	if !sameOrWithin(rootPath, resolved) {
		return "", "", nil, ErrPathTraversal
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return "", "", nil, err
	}
	return resolved, relative, info, nil
}

func normalizeRelativePath(raw string) (string, error) {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	if raw == "" || raw == "/" || raw == "." {
		return "", nil
	}
	if strings.HasPrefix(raw, "/") || filepath.IsAbs(filepath.FromSlash(raw)) {
		return "", ErrPathTraversal
	}
	clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(raw)))
	if clean == "." {
		return "", nil
	}
	if clean == ".." || strings.HasPrefix(clean, "../") {
		return "", ErrPathTraversal
	}
	return strings.TrimPrefix(clean, "./"), nil
}

// ValidateRootPath is exported for operation and editor packages that need the same boundary.
func (s *Service) ValidateRootPath(rootID, relative string) (Root, string, string, error) {
	root, err := s.rootByID(rootID)
	if err != nil {
		return Root{}, "", "", err
	}
	abs, normalized, info, err := s.resolveExistingPath(root, relative)
	if err == nil && !info.IsDir() {
		err = ErrNotDirectory
	}
	return root, abs, normalized, err
}

// ValidateFilePath resolves a root-relative regular file without exposing path joining to callers.
func (s *Service) ValidateFilePath(rootID, relative string) (Root, string, string, os.FileInfo, error) {
	root, err := s.rootByID(rootID)
	if err != nil {
		return Root{}, "", "", nil, err
	}
	abs, normalized, info, err := s.resolveExistingPath(root, relative)
	if err == nil && !info.Mode().IsRegular() {
		err = ErrNotFile
	}
	return root, abs, normalized, info, err
}
