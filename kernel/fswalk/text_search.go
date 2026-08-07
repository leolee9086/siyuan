package fswalk

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// TextLine 是行匹配函数可见的根相对文本行。
type TextLine struct {
	Path   string
	Number int
	Text   string
}

// TextMatch 是 SearchText 返回的一条匹配。
type TextMatch = TextLine

// TextSearchQuery 只包含内容搜索需要的声明式规则和边界。
type TextSearchQuery struct {
	Walk           WalkOptions
	MaxFileBytes   int64
	MaxMatches     int
	ReadWorkers    int
	PruneDirectory func(Metadata) bool
	SelectFile     func(Metadata) bool
	MatchLine      func(TextLine) bool
}

// TextSearchResult 汇总搜索命中、跳过原因和有界文件错误。
type TextSearchResult struct {
	Traversal          Result
	CandidateFileCount int
	ScannedFileCount   int
	SkippedLargeCount  int
	SkippedBinaryCount int
	FileErrorCount     int
	FileErrors         []PathError
	ErrorsTruncated    bool
	Matches            []TextMatch
	MatchLimitReached  bool
}

type textSearchJob struct {
	sequence uint64
	entry    Metadata
	absolute string
}

type textSearchFileResult struct {
	sequence uint64
	path     string
	matches  []TextMatch
	err      error
	large    bool
	binary   bool
	scanned  bool
}

type textSearchTraversalResult struct {
	result Result
	err    error
}

// SearchText 并发读取并搜索一个根相对文件或目录。
func (w *Walker) SearchText(ctx context.Context, relative string, query TextSearchQuery) (TextSearchResult, error) {
	if query.MatchLine == nil {
		return TextSearchResult{}, errors.New("text line matcher is required")
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return TextSearchResult{}, err
	}
	searchCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	workers := normalizeWorkers(query.ReadWorkers)
	jobs := make(chan textSearchJob, workers*2)
	files := make(chan textSearchFileResult, workers*2)
	var workerWait sync.WaitGroup
	for range workers {
		workerWait.Add(1)
		go w.searchTextWorker(searchCtx, query, jobs, files, &workerWait)
	}

	traversal := make(chan textSearchTraversalResult, 1)
	go func() {
		result, walkErr := w.enqueueTextSearch(searchCtx, target, query, jobs)
		close(jobs)
		workerWait.Wait()
		close(files)
		traversal <- textSearchTraversalResult{result: result, err: walkErr}
	}()

	result := TextSearchResult{Matches: []TextMatch{}, FileErrors: []PathError{}}
	pending := map[uint64]textSearchFileResult{}
	nextSequence := uint64(0)
	for file := range files {
		pending[file.sequence] = file
		for {
			ready, ok := pending[nextSequence]
			if !ok {
				break
			}
			delete(pending, nextSequence)
			nextSequence++
			result.commitTextSearchFile(ready, query, cancel)
		}
	}
	walked := <-traversal
	result.Traversal = walked.result
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if walked.err != nil && !(result.MatchLimitReached && errors.Is(walked.err, context.Canceled)) {
		return result, walked.err
	}
	return result, nil
}

func (w *Walker) enqueueTextSearch(ctx context.Context, target boundTarget, query TextSearchQuery,
	jobs chan<- textSearchJob) (Result, error) {
	sequence := uint64(0)
	enqueue := func(entry Metadata, absolute string) error {
		if entry.IsDir {
			if query.PruneDirectory != nil && query.PruneDirectory(entry) {
				return fs.SkipDir
			}
			return nil
		}
		if entry.IsSymlink || entry.Restricted || !entry.IsRegular {
			return nil
		}
		if query.SelectFile != nil && !query.SelectFile(entry) {
			return nil
		}
		job := textSearchJob{sequence: sequence, entry: entry, absolute: absolute}
		sequence++
		select {
		case jobs <- job:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if target.info.Mode().IsRegular() {
		entry := metadataFromFileInfo(target.relative, target.info, 0)
		err := enqueue(entry, target.absolute)
		return Result{Path: target.relative, EntryCount: 1, FileCount: 1}, err
	}
	request := newWalkRequest(w.root, target.absolute, target.relative, query.Walk)
	return walkWithPath(ctx, request, enqueue)
}

func (w *Walker) searchTextWorker(ctx context.Context, query TextSearchQuery, jobs <-chan textSearchJob,
	results chan<- textSearchFileResult, wait *sync.WaitGroup) {
	defer wait.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-jobs:
			if !ok {
				return
			}
			result := w.searchTextFile(ctx, query, job)
			select {
			case results <- result:
			case <-ctx.Done():
				return
			}
		}
	}
}

func (w *Walker) searchTextFile(ctx context.Context, query TextSearchQuery,
	job textSearchJob) textSearchFileResult {
	result := textSearchFileResult{sequence: job.sequence, path: job.entry.Path}
	file, err := w.readText(ctx, job.entry.Path, job.absolute, query.MaxFileBytes)
	if err != nil {
		result.large = errors.Is(err, ErrTextFileTooLarge)
		result.binary = errors.Is(err, ErrBinaryText) || errors.Is(err, ErrInvalidUTF8)
		if !result.large && !result.binary && !errors.Is(err, context.Canceled) {
			result.err = err
		}
		return result
	}
	result.scanned = true
	for lineNumber, line := range strings.Split(file.text, "\n") {
		candidate := TextLine{Path: job.entry.Path, Number: lineNumber + 1, Text: line}
		if query.MatchLine(candidate) {
			result.matches = append(result.matches, candidate)
			if query.MaxMatches > 0 && len(result.matches) >= query.MaxMatches {
				break
			}
		}
	}
	return result
}

func (r *TextSearchResult) commitTextSearchFile(file textSearchFileResult, query TextSearchQuery,
	cancel context.CancelFunc) {
	r.CandidateFileCount++
	if file.large {
		r.SkippedLargeCount++
		return
	}
	if file.binary {
		r.SkippedBinaryCount++
		return
	}
	if file.err != nil {
		r.FileErrorCount++
		maxErrors := query.Walk.MaxErrors
		if maxErrors <= 0 {
			maxErrors = DefaultRetainedErrors
		}
		if len(r.FileErrors) < maxErrors {
			r.FileErrors = append(r.FileErrors, PathError{Path: file.path, Err: file.err})
		} else {
			r.ErrorsTruncated = true
		}
		return
	}
	if file.scanned {
		r.ScannedFileCount++
	}
	for _, match := range file.matches {
		if query.MaxMatches > 0 && len(r.Matches) >= query.MaxMatches {
			r.MatchLimitReached = true
			cancel()
			return
		}
		r.Matches = append(r.Matches, match)
	}
	if query.MaxMatches > 0 && len(r.Matches) >= query.MaxMatches {
		r.MatchLimitReached = true
		cancel()
	}
}

func metadataFromFileInfo(relative string, info os.FileInfo, depth int) Metadata {
	return Metadata{
		Name: info.Name(), Path: filepath.ToSlash(relative),
		IsRegular: info.Mode().IsRegular(), Size: info.Size(),
		Updated: info.ModTime().Unix(), Depth: depth,
	}
}
