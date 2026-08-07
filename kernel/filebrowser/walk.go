package filebrowser

import (
	"context"
	"errors"
	"os"
	"sort"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

const (
	defaultWalkDepth   = 64
	maxWalkDepth       = 256
	defaultWalkEntries = 100_000
	maxWalkEntries     = 1_000_000
)

type walkOptions struct {
	maxDepth   int
	maxEntries int
	workers    int
}

// Walk returns a bounded recursive snapshot using the shared filesystem module.
func (s *Service) Walk(request WalkRequest) (WalkResult, error) {
	return s.WalkContext(context.Background(), request)
}

// WalkContext retains deterministic file-browser output while fswalk owns the
// traversal, path boundary, link classification and concurrent scheduling.
func (s *Service) WalkContext(ctx context.Context, request WalkRequest) (WalkResult, error) {
	root, _, relative, err := s.ValidateRootPath(request.RootID, request.Path)
	if err != nil {
		return WalkResult{}, err
	}
	options := normalizeWalkOptions(request)
	walker, err := fswalk.New(root.Path)
	if err != nil {
		return WalkResult{}, adaptFSWalkError(err)
	}
	entries := make([]WalkEntry, 0, min(options.maxEntries, 4096))
	scan, err := walker.Walk(ctx, relative, fswalk.WalkOptions{
		MaxDepth: options.maxDepth, MaxEntries: options.maxEntries,
		Workers: options.workers, MaxErrors: maxRetainedScanErrors,
		SortEntries: true,
	}, func(entry fswalk.Metadata) error {
		entries = append(entries, WalkEntry{Entry: browserEntry(entry), Depth: entry.Depth})
		return nil
	})
	if err != nil {
		return WalkResult{}, adaptFSWalkError(err)
	}
	sort.SliceStable(entries, func(left, right int) bool {
		leftPath, rightPath := strings.ToLower(entries[left].Path), strings.ToLower(entries[right].Path)
		if leftPath != rightPath {
			return leftPath < rightPath
		}
		return entries[left].Path < entries[right].Path
	})
	walkErrors := make([]WalkError, 0, len(scan.Errors))
	for _, pathError := range scan.Errors {
		walkErrors = append(walkErrors, makeWalkError(pathError.Path, pathError.Err))
	}
	return WalkResult{
		Root: root, Path: relative, Entries: entries,
		FileCount: scan.FileCount, DirectoryCount: scan.DirectoryCount,
		ScannedDirectoryCount: scan.ScannedDirectoryCount, Errors: walkErrors,
		MaxDepth: options.maxDepth, MaxEntries: options.maxEntries,
		EntryLimitReached: scan.EntryLimitReached,
		DepthLimitReached: scan.DepthLimitReached, Truncated: scan.Truncated,
	}, nil
}

func normalizeWalkOptions(request WalkRequest) walkOptions {
	depth := request.MaxDepth
	if depth <= 0 {
		depth = defaultWalkDepth
	} else if depth > maxWalkDepth {
		depth = maxWalkDepth
	}
	entries := request.MaxEntries
	if entries <= 0 {
		entries = defaultWalkEntries
	} else if entries > maxWalkEntries {
		entries = maxWalkEntries
	}
	return walkOptions{maxDepth: depth, maxEntries: entries, workers: boundedIOWorkers(32)}
}

func makeWalkError(relative string, err error) WalkError {
	switch {
	case errors.Is(err, fswalk.ErrDirectoryChangedToReparsePoint):
		return WalkError{Path: relative, Code: "path-boundary", Message: "directory changed to a restricted link"}
	case errors.Is(err, os.ErrPermission):
		return WalkError{Path: relative, Code: "permission-denied", Message: "directory access denied"}
	case errors.Is(err, os.ErrNotExist):
		return WalkError{Path: relative, Code: "not-found", Message: "directory no longer exists"}
	default:
		return WalkError{Path: relative, Code: "io-error", Message: "directory could not be read"}
	}
}
