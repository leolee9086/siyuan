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

// ListRoots returns the workspace root and all unique bound directories. Roots
// with a physical ancestor are collapsed into that ancestor for presentation;
// the absorbed roots remain addressable through Root.Mounts and their original
// IDs. Missing bindings remain visible so users can repair or unbind them.
func (s *Service) ListRoots() ([]Root, error) {
	workspace, err := absoluteCleanPath(s.workspacePath)
	if err != nil {
		return nil, err
	}
	workspaceResolved, workspaceExists := resolveDirectory(workspace)
	workspaceKey := pathKey(workspaceResolved)
	rootMap := map[string]*Root{}
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
			}
			root.Sources = append(root.Sources, RootSource{
				SessionID: sessionID, DirectoryID: grant.ID, Name: grant.Name, Path: path,
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

	roots := collapseRootHierarchy(rootMap)
	sort.SliceStable(roots, func(i, j int) bool {
		if roots[i].Kind != roots[j].Kind {
			return roots[i].Kind == RootKindWorkspace
		}
		return pathKey(roots[i].Path) < pathKey(roots[j].Path)
	})
	return roots, nil
}

// collapseRootHierarchy selects the smallest physical ancestors as displayed
// roots and records every descendant as a mount. The original roots are not
// discarded: rootByID resolves mount IDs back to their own path and capability.
func collapseRootHierarchy(rootMap map[string]*Root) []Root {
	all := make([]*Root, 0, len(rootMap))
	for _, root := range rootMap {
		root.Permission = aggregatePermission(root)
		sortRootSources(root)
		all = append(all, root)
	}
	top := make(map[string]bool, len(all))
	for _, child := range all {
		top[pathKey(child.Path)] = true
		for _, parent := range all {
			if parent == child || !isStrictRootAncestor(parent, child) {
				continue
			}
			top[pathKey(child.Path)] = false
			break
		}
	}
	for _, child := range all {
		if !top[pathKey(child.Path)] {
			parent := displayedRootAncestor(child, all, top)
			if parent != nil {
				parent.Mounts = append(parent.Mounts, rootMount(*child, parent.Path))
			}
		}
	}
	result := make([]Root, 0, len(all))
	for _, root := range all {
		if !top[pathKey(root.Path)] {
			continue
		}
		sortRootMounts(root)
		result = append(result, *root)
	}
	return result
}

func sortRootSources(root *Root) {
	sort.SliceStable(root.Sources, func(i, j int) bool {
		if root.Sources[i].SessionID != root.Sources[j].SessionID {
			return root.Sources[i].SessionID < root.Sources[j].SessionID
		}
		if root.Sources[i].DirectoryID != root.Sources[j].DirectoryID {
			return root.Sources[i].DirectoryID < root.Sources[j].DirectoryID
		}
		return pathKey(root.Sources[i].Path) < pathKey(root.Sources[j].Path)
	})
}

func sortRootMounts(root *Root) {
	sort.SliceStable(root.Mounts, func(i, j int) bool {
		left, right := root.Mounts[i], root.Mounts[j]
		if pathKey(left.RelativePath) != pathKey(right.RelativePath) {
			return pathKey(left.RelativePath) < pathKey(right.RelativePath)
		}
		return left.ID < right.ID
	})
}

func isStrictRootAncestor(parent, child *Root) bool {
	if pathKey(parent.Path) == pathKey(child.Path) {
		return false
	}
	// Missing roots remain visible as repairable top-level bindings. A lexical
	// relation is not enough to hide either side when its target is unavailable.
	if !parent.Exists || !child.Exists {
		return false
	}
	return sameOrWithin(parent.Path, child.Path)
}

func displayedRootAncestor(child *Root, roots []*Root, top map[string]bool) *Root {
	var displayed *Root
	for _, candidate := range roots {
		if !top[pathKey(candidate.Path)] || !isStrictRootAncestor(candidate, child) {
			continue
		}
		if displayed == nil || len(filepath.Clean(candidate.Path)) < len(filepath.Clean(displayed.Path)) {
			displayed = candidate
		}
	}
	return displayed
}

func rootMount(root Root, parentPath string) RootMount {
	relative := ""
	if rel, err := filepath.Rel(parentPath, root.Path); err == nil && rel != "." && !filepath.IsAbs(rel) {
		relative = filepath.ToSlash(rel)
	}
	return RootMount{
		ID: root.ID, Kind: root.Kind, Label: root.Label, Path: root.Path,
		RelativePath: relative, Permission: root.Permission,
		Capabilities: root.Capabilities, Sources: append([]RootSource(nil), root.Sources...), Exists: root.Exists,
	}
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
		for _, mount := range root.Mounts {
			if mount.ID == id {
				return mount.AsRoot(), nil
			}
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
