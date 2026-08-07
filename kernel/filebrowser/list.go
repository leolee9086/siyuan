package filebrowser

import (
	"context"
	"path/filepath"
	"sort"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

const (
	defaultListLimit = 200
	maxListLimit     = 2000
)

// List returns a sorted, paged listing for one root-relative directory.
func (s *Service) List(request ListRequest) (ListResult, error) {
	return s.ListContext(context.Background(), request)
}

// ListContext returns a directory page and stops optional child counting when the request is canceled.
func (s *Service) ListContext(ctx context.Context, request ListRequest) (ListResult, error) {
	root, _, relative, err := s.ValidateRootPath(request.RootID, request.Path)
	if err != nil {
		return ListResult{}, err
	}
	entries, err := readEntriesContext(ctx, root, relative)
	if err != nil {
		return ListResult{}, err
	}
	directoriesFirst := true
	if request.DirectoriesFirst != nil {
		directoriesFirst = *request.DirectoriesFirst
	}
	sortEntries(entries, request.SortBy, request.SortDirection, directoriesFirst)

	limit := request.Limit
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}
	offset := request.Offset
	if offset < 0 {
		offset = 0
	}
	if offset > len(entries) {
		offset = len(entries)
	}
	end := offset + limit
	if end > len(entries) {
		end = len(entries)
	}
	page := entries[offset:end]
	if request.IncludeChildCounts {
		populateChildCounts(ctx, root, page)
	}
	fileCount, directoryCount := countEntryTypes(entries)
	return ListResult{
		Root: root, Path: relative, Entries: page, Total: len(entries),
		FileCount: fileCount, DirectoryCount: directoryCount,
		Offset: offset, Limit: limit, HasMore: end < len(entries),
	}, nil
}

func readEntriesContext(ctx context.Context, root Root, relative string) ([]Entry, error) {
	walker, err := fswalk.New(root.Path)
	if err != nil {
		return nil, adaptFSWalkError(err)
	}
	items, err := walker.ReadDirectory(ctx, relative, false)
	if err != nil {
		return nil, adaptFSWalkError(err)
	}
	entries := make([]Entry, 0, len(items))
	for _, item := range items {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		entries = append(entries, browserEntry(item))
	}
	return entries, nil
}

func browserEntry(item fswalk.Metadata) Entry {
	entry := Entry{
		Name: item.Name, Path: item.Path, IsDir: item.IsDir,
		IsSymlink: item.IsSymlink, Restricted: item.Restricted,
		Hidden: item.Hidden, Size: item.Size, Updated: item.Updated,
	}
	if !entry.IsDir {
		entry.Extension = strings.ToLower(filepath.Ext(item.Name))
	}
	return entry
}

func countEntryTypes(entries []Entry) (files, directories int) {
	for _, entry := range entries {
		if entry.IsDir {
			directories++
		} else {
			files++
		}
	}
	return files, directories
}

func sortEntries(entries []Entry, field, direction string, directoriesFirst bool) {
	descending := strings.EqualFold(direction, "desc")
	sort.SliceStable(entries, func(i, j int) bool {
		left, right := entries[i], entries[j]
		if directoriesFirst && left.IsDir != right.IsDir {
			return left.IsDir
		}
		compare := 0
		switch strings.ToLower(field) {
		case "size":
			compare = compareInt64(left.Size, right.Size)
		case "updated", "mtime":
			compare = compareInt64(left.Updated, right.Updated)
		case "type", "extension":
			compare = strings.Compare(left.Extension, right.Extension)
		default:
			compare = strings.Compare(strings.ToLower(left.Name), strings.ToLower(right.Name))
		}
		if compare == 0 {
			compare = strings.Compare(left.Path, right.Path)
		}
		if descending {
			return compare > 0
		}
		return compare < 0
	})
}

func compareInt64(left, right int64) int {
	if left < right {
		return -1
	}
	if left > right {
		return 1
	}
	return 0
}
