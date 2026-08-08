package filebrowser

import (
	"runtime"
	"strings"
)

// RootKind identifies the owner of a browsable filesystem root.
type RootKind string

const (
	RootKindWorkspace RootKind = "workspace"
	RootKindAgent     RootKind = "agent-task-directory"
)

// RootCapabilities describes actions exposed by the browser for a root.
type RootCapabilities struct {
	Browse  bool `json:"browse"`
	Write   bool `json:"write"`
	Command bool `json:"command"`
}

// RootSource identifies the agent session and grant that contributed a root.
type RootSource struct {
	SessionID   string `json:"sessionID"`
	DirectoryID string `json:"directoryID"`
	Name        string `json:"name"`
	Path        string `json:"path"`
	Permission  string `json:"permission"`
	External    bool   `json:"external"`
	BoundAt     int64  `json:"boundAt"`
}

// RootMount describes a root hidden beneath a displayed ancestor root. The
// original ID and path remain addressable, while the tree renders the physical
// directory only once through its ancestor.
type RootMount struct {
	ID           string           `json:"id"`
	Kind         RootKind         `json:"kind"`
	Label        string           `json:"label"`
	Path         string           `json:"path"`
	RelativePath string           `json:"relativePath"`
	Permission   string           `json:"permission"`
	Capabilities RootCapabilities `json:"capabilities"`
	Sources      []RootSource     `json:"sources,omitempty"`
	Exists       bool             `json:"exists"`
}

// AsRoot restores the original root contract for a legacy request targeting
// a mounted root. It intentionally does not copy the display root's mounts.
func (mount RootMount) AsRoot() Root {
	return Root{
		ID: mount.ID, Kind: mount.Kind, Label: mount.Label, Path: mount.Path,
		Permission: mount.Permission, Capabilities: mount.Capabilities,
		Sources: append([]RootSource(nil), mount.Sources...), Exists: mount.Exists,
	}
}

// Root is a stable, displayable filesystem root.
type Root struct {
	ID           string           `json:"id"`
	Kind         RootKind         `json:"kind"`
	Label        string           `json:"label"`
	Path         string           `json:"path"`
	Permission   string           `json:"permission"`
	Capabilities RootCapabilities `json:"capabilities"`
	Sources      []RootSource     `json:"sources,omitempty"`
	Mounts       []RootMount      `json:"mounts,omitempty"`
	Exists       bool             `json:"exists"`
}

// CapabilitiesForPath returns the most specific capability scope for a
// root-relative path. A displayed ancestor may contain a writable workspace
// mount inside an otherwise read-only Agent root.
func (root Root) CapabilitiesForPath(relative string) RootCapabilities {
	relative = normalizeRootRelative(relative)
	best := root.Capabilities
	bestPrefixLength := 0
	for _, mount := range root.Mounts {
		prefix := normalizeRootRelative(mount.RelativePath)
		if prefix == "" || !rootPathHasPrefix(relative, prefix) || len(prefix) <= bestPrefixLength {
			continue
		}
		best = mount.Capabilities
		bestPrefixLength = len(prefix)
	}
	return best
}

func normalizeRootRelative(value string) string {
	return strings.Trim(strings.ReplaceAll(strings.TrimSpace(value), "\\", "/"), "/")
}

func rootPathHasPrefix(value, prefix string) bool {
	if value == prefix {
		return true
	}
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		value, prefix = strings.ToLower(value), strings.ToLower(prefix)
	}
	return strings.HasPrefix(value, prefix+"/")
}

// Entry is a single directory item returned by List.
type Entry struct {
	Name                string `json:"name"`
	Path                string `json:"path"`
	IsDir               bool   `json:"isDir"`
	IsSymlink           bool   `json:"isSymlink"`
	Restricted          bool   `json:"restricted"`
	Hidden              bool   `json:"hidden"`
	Size                int64  `json:"size"`
	Updated             int64  `json:"updated"`
	Extension           string `json:"extension,omitempty"`
	ChildFileCount      int    `json:"childFileCount,omitempty"`
	ChildDirectoryCount int    `json:"childDirectoryCount,omitempty"`
	ChildCountKnown     bool   `json:"childCountKnown,omitempty"`
}

// PreviewKind selects the existing frontend surface used to inspect a file.
type PreviewKind string

const (
	PreviewKindDirectory PreviewKind = "directory"
	PreviewKindImage     PreviewKind = "image"
	PreviewKindAudio     PreviewKind = "audio"
	PreviewKindVideo     PreviewKind = "video"
	PreviewKindPDF       PreviewKind = "pdf"
	PreviewKindText      PreviewKind = "text"
	PreviewKindD5A       PreviewKind = "d5a"
	PreviewKindBinary    PreviewKind = "binary"
)

// FileRequest addresses one file relative to an authorized root.
type FileRequest struct {
	RootID string `json:"rootID"`
	Path   string `json:"path"`
}

// StatResult describes a validated file and its frontend opening target.
type StatResult struct {
	Root        Root        `json:"root"`
	Entry       Entry       `json:"entry"`
	MediaType   string      `json:"mediaType"`
	PreviewKind PreviewKind `json:"previewKind"`
	ContentURL  string      `json:"contentURL"`
	Revision    string      `json:"revision"`
}

// ItemProperties 是文件属性 Dock 使用的文件或目录物理快照。
type ItemProperties struct {
	Root        Root        `json:"root"`
	Entry       Entry       `json:"entry"`
	MediaType   string      `json:"mediaType,omitempty"`
	PreviewKind PreviewKind `json:"previewKind"`
	ContentURL  string      `json:"contentURL,omitempty"`
	Revision    string      `json:"revision"`
	Created     int64       `json:"created,omitempty"`
	Width       int         `json:"width,omitempty"`
	Height      int         `json:"height,omitempty"`
	ReadOnly    bool        `json:"readOnly"`
}

// PropertyFailure 是批量读取中单个地址的稳定错误。
type PropertyFailure struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// PropertyItemResult 保持请求地址和对应结果，不因其它项失败而丢失。
type PropertyItemResult struct {
	Request    FileRequest      `json:"request"`
	Properties *ItemProperties  `json:"properties,omitempty"`
	Error      *PropertyFailure `json:"error,omitempty"`
}

// BatchPropertiesRequest 描述一次有界的文件/目录属性读取。
type BatchPropertiesRequest struct {
	Items []FileRequest `json:"items"`
}

// BatchPropertiesResult 按输入顺序返回逐项结果。
type BatchPropertiesResult struct {
	Items        []PropertyItemResult `json:"items"`
	SuccessCount int                  `json:"successCount"`
	FailureCount int                  `json:"failureCount"`
}

// PreviewRequest bounds a text preview read. MaxBytes is clamped by the service.
type PreviewRequest struct {
	RootID   string `json:"rootID"`
	Path     string `json:"path"`
	MaxBytes int    `json:"maxBytes"`
}

// PreviewResult is a bounded, decoded text preview.
type PreviewResult struct {
	Stat      StatResult `json:"stat"`
	Text      string     `json:"text"`
	Encoding  string     `json:"encoding"`
	Truncated bool       `json:"truncated"`
}

// ListRequest describes a paged directory query. Path is relative to RootID.
type ListRequest struct {
	RootID             string `json:"rootID"`
	Path               string `json:"path"`
	Offset             int    `json:"offset"`
	Limit              int    `json:"limit"`
	SortBy             string `json:"sortBy"`
	SortDirection      string `json:"sortDirection"`
	DirectoriesFirst   *bool  `json:"directoriesFirst"`
	IncludeChildCounts bool   `json:"includeChildCounts"`
}

// ListResult is the deterministic response for one directory query.
type ListResult struct {
	Root           Root    `json:"root"`
	Path           string  `json:"path"`
	Entries        []Entry `json:"entries"`
	Total          int     `json:"total"`
	FileCount      int     `json:"fileCount"`
	DirectoryCount int     `json:"directoryCount"`
	Offset         int     `json:"offset"`
	Limit          int     `json:"limit"`
	HasMore        bool    `json:"hasMore"`
}

// WalkRequest describes one bounded recursive traversal below a root-relative directory.
type WalkRequest struct {
	RootID     string `json:"rootID"`
	Path       string `json:"path"`
	MaxDepth   int    `json:"maxDepth"`
	MaxEntries int    `json:"maxEntries"`
}

// WalkError records a directory that could not be read without exposing an absolute path.
type WalkError struct {
	Path    string `json:"path"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WalkEntry adds traversal depth to the shared file entry contract.
type WalkEntry struct {
	Entry
	Depth int `json:"depth"`
}

// WalkResult contains a deterministic, bounded recursive snapshot.
type WalkResult struct {
	Root                  Root        `json:"root"`
	Path                  string      `json:"path"`
	Entries               []WalkEntry `json:"entries"`
	FileCount             int         `json:"fileCount"`
	DirectoryCount        int         `json:"directoryCount"`
	ScannedDirectoryCount int         `json:"scannedDirectoryCount"`
	Errors                []WalkError `json:"errors,omitempty"`
	MaxDepth              int         `json:"maxDepth"`
	MaxEntries            int         `json:"maxEntries"`
	EntryLimitReached     bool        `json:"entryLimitReached"`
	DepthLimitReached     bool        `json:"depthLimitReached"`
	Truncated             bool        `json:"truncated"`
}
