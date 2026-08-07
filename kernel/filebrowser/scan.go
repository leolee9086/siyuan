package filebrowser

import (
	"context"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

const maxRetainedScanErrors = fswalk.DefaultRetainedErrors

// ScanRequest 描述不保留全量条目的一次递归扫描。非正深度和条目数表示不设限制。
type ScanRequest struct {
	RootID     string
	Path       string
	MaxDepth   int
	MaxEntries int
	Workers    int
}

// ScanVisitor 在遍历协调 goroutine 中逐项调用；返回错误立即停止。
type ScanVisitor func(WalkEntry) error

// ScanResult 汇总流式扫描状态，仅保留有界数量的目录错误。
type ScanResult struct {
	Root                  Root
	Path                  string
	EntryCount            int
	FileCount             int
	DirectoryCount        int
	ScannedDirectoryCount int
	ErrorCount            int
	Errors                []WalkError
	ErrorsTruncated       bool
	EntryLimitReached     bool
	DepthLimitReached     bool
	Truncated             bool
}

// ScanContext 只做文件浏览领域对象适配；路径、链接、并发和错误由 fswalk 负责。
func (s *Service) ScanContext(ctx context.Context, request ScanRequest, visitor ScanVisitor) (ScanResult, error) {
	root, _, relative, err := s.ValidateRootPath(request.RootID, request.Path)
	if err != nil {
		return ScanResult{}, err
	}
	walker, err := fswalk.New(root.Path)
	if err != nil {
		return ScanResult{}, adaptFSWalkError(err)
	}
	result, err := walker.Walk(ctx, relative, fswalk.WalkOptions{
		MaxDepth: request.MaxDepth, MaxEntries: request.MaxEntries,
		Workers: request.Workers, MaxErrors: maxRetainedScanErrors,
	}, func(entry fswalk.Metadata) error {
		if visitor == nil {
			return nil
		}
		return visitor(WalkEntry{Entry: browserEntry(entry), Depth: entry.Depth})
	})
	return adaptScanResult(root, relative, result), adaptFSWalkError(err)
}

func adaptScanResult(root Root, relative string, result fswalk.Result) ScanResult {
	errors := make([]WalkError, 0, len(result.Errors))
	for _, pathError := range result.Errors {
		errors = append(errors, makeWalkError(pathError.Path, pathError.Err))
	}
	return ScanResult{
		Root: root, Path: relative, EntryCount: result.EntryCount,
		FileCount: result.FileCount, DirectoryCount: result.DirectoryCount,
		ScannedDirectoryCount: result.ScannedDirectoryCount,
		ErrorCount:            result.ErrorCount, Errors: errors,
		ErrorsTruncated:   result.ErrorsTruncated,
		EntryLimitReached: result.EntryLimitReached,
		DepthLimitReached: result.DepthLimitReached, Truncated: result.Truncated,
	}
}
