// Package fswalk 提供绑定授权根的文件系统遍历与文本处理能力。
//
// Walker 在构造时固定根目录。后续公开操作只接收根相对路径，且不会向
// 调用方暴露绝对路径、os.File 或可直接执行读写的文件句柄。
package fswalk

import (
	"errors"
	"path/filepath"
	"runtime"
	"strings"
)

var (
	ErrRootUnavailable                = errors.New("filesystem root is unavailable")
	ErrRootNotAbsolute                = errors.New("filesystem root must be absolute")
	ErrStartUnavailable               = errors.New("filesystem traversal start is unavailable")
	ErrPathTraversal                  = errors.New("filesystem path escapes root")
	ErrPathComponentNotDirectory      = errors.New("filesystem path component is not a directory")
	ErrDirectoryChangedToReparsePoint = errors.New("directory changed to a reparse point")
	ErrNotRegularFile                 = errors.New("filesystem path is not a regular file")
	ErrTextFileTooLarge               = errors.New("text file exceeds the configured read limit")
	ErrBinaryText                     = errors.New("file contains binary data")
	ErrInvalidUTF8                    = errors.New("file is not valid UTF-8")
	ErrTransformPlanOwner             = errors.New("text transform plan belongs to another walker")
	ErrTransformPlanApplied           = errors.New("text transform plan was already applied")
	ErrFileChanged                    = errors.New("file changed after the transform plan was created")
	ErrTransformChanged               = errors.New("text transform result changed after planning")
	ErrCopyPathOverlap                = errors.New("copy source and destination paths overlap")
	ErrCopySymlink                    = errors.New("copy source contains a symbolic link")
	ErrCopyUnsupportedFile            = errors.New("copy source contains an unsupported file type")
	ErrCopyDestinationType            = errors.New("copy destination has an incompatible file type")
	ErrInvalidJSONKey                 = errors.New("JSON store key must name a document")
	ErrDirectoryNotEmpty              = errors.New("directory is not empty")
	ErrRootMutation                   = errors.New("filesystem root cannot be mutated")
	ErrPathExists                     = errors.New("filesystem destination already exists")
	ErrMovePathOverlap                = errors.New("move source and destination paths overlap")
	ErrTextLineOutOfRange             = errors.New("text line offset is out of range")
)

const DefaultRetainedErrors = 4096

// Metadata 是调用方可见的根相对目录项快照，不包含可用于直接 I/O 的路径。
type Metadata struct {
	Name       string
	Path       string
	IsDir      bool
	IsSymlink  bool
	IsRegular  bool
	Restricted bool
	Hidden     bool
	Size       int64
	Updated    int64
	Depth      int
}

// WalkOptions 只描述遍历调度和结果边界，不承载内容搜索或写入策略。
type WalkOptions struct {
	MaxDepth    int
	MaxEntries  int
	Workers     int
	MaxErrors   int
	SortEntries bool
}

// Visitor 声明目录项处理方式。返回 fs.SkipDir 可剪枝目录，返回 fs.SkipAll 可正常停止。
type Visitor func(Metadata) error

// PathError 记录无法处理的根相对路径。
type PathError struct {
	Path string
	Err  error
}

func (e PathError) Error() string {
	if e.Err == nil {
		return e.Path
	}
	if e.Path == "" {
		return e.Err.Error()
	}
	return e.Path + ": " + e.Err.Error()
}

func (e PathError) Unwrap() error { return e.Err }

// Result 汇总遍历计数和有界错误明细。Path 始终是根相对路径。
type Result struct {
	Path                  string
	EntryCount            int
	FileCount             int
	DirectoryCount        int
	ScannedDirectoryCount int
	ErrorCount            int
	Errors                []PathError
	ErrorsTruncated       bool
	EntryLimitReached     bool
	DepthLimitReached     bool
	Stopped               bool
	Truncated             bool
}

type walkRequest struct {
	root        string
	directory   string
	path        string
	maxDepth    int
	maxEntries  int
	workers     int
	maxErrors   int
	sort        bool
	stopOnError bool
}

func newWalkRequest(root, directory, relative string, options WalkOptions) walkRequest {
	maxErrors := options.MaxErrors
	if maxErrors <= 0 {
		maxErrors = DefaultRetainedErrors
	}
	workers := options.Workers
	if workers < 0 {
		workers = 0
	}
	return walkRequest{
		root: root, directory: directory, path: relative,
		maxDepth: options.MaxDepth, maxEntries: options.MaxEntries,
		workers: workers, maxErrors: maxErrors, sort: options.SortEntries,
	}
}

func absoluteClean(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ErrRootUnavailable
	}
	if !filepath.IsAbs(raw) {
		return "", ErrRootNotAbsolute
	}
	return filepath.Clean(raw), nil
}

func normalizeRelative(raw string) (string, error) {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	if raw == "" || raw == "." || raw == "/" {
		return "", nil
	}
	if strings.HasPrefix(raw, "/") || filepath.IsAbs(filepath.FromSlash(raw)) {
		return "", ErrPathTraversal
	}
	clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(raw)))
	if clean == ".." || strings.HasPrefix(clean, "../") {
		return "", ErrPathTraversal
	}
	return strings.TrimPrefix(clean, "./"), nil
}

func sameOrWithin(root, target string) bool {
	relative, err := filepath.Rel(root, target)
	if err != nil || filepath.IsAbs(relative) {
		return false
	}
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		relative = strings.ToLower(relative)
	}
	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

// RecommendedWorkers 返回底层遍历使用的有界并发数。
func RecommendedWorkers(jobCount int) int {
	if jobCount <= 0 {
		return 0
	}
	workers := runtime.GOMAXPROCS(0) * 2
	if workers < 4 {
		workers = 4
	}
	if workers > 32 {
		workers = 32
	}
	if workers > jobCount {
		workers = jobCount
	}
	return workers
}
