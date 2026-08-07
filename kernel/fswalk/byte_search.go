package fswalk

import (
	"bytes"
	"context"
	"errors"
	"io"
	"sync"
)

// ByteSearchQuery 描述任意字节目标搜索的目标集合和文件筛选规则。
type ByteSearchQuery struct {
	Targets     []string
	ReadWorkers int
	SelectFile  func(Metadata) bool
}

// ByteSearchMatch 是一个文件内命中的目标。Path 始终是根相对路径。
type ByteSearchMatch struct {
	Path   string
	Target string
}

// ByteSearchResult 汇总字节搜索的文件读取和命中结果。
type ByteSearchResult struct {
	Traversal          Result
	CandidateFileCount int
	ScannedFileCount   int
	FileErrorCount     int
	FileErrors         []PathError
	ErrorsTruncated    bool
	Matches            []ByteSearchMatch
}

type byteSearchJob struct {
	sequence uint64
	entry    Metadata
	absolute string
}

type byteSearchFileResult struct {
	sequence uint64
	path     string
	matched  []string
	err      error
}

// SearchByteTargets 搜索一个根相对文件或目录中的任意字节目标。
// 该入口不做文本解码，也不复用 UTF-8 行搜索的读取和匹配策略。
func (w *Walker) SearchByteTargets(ctx context.Context, relative string,
	query ByteSearchQuery) (ByteSearchResult, error) {
	index, maxLength := buildByteTargetIndex(query.Targets)
	result := ByteSearchResult{FileErrors: []PathError{}, Matches: []ByteSearchMatch{}}
	if len(index) == 0 {
		return result, nil
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return result, err
	}
	searchCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	workers := normalizeWorkers(query.ReadWorkers)
	jobs := make(chan byteSearchJob, workers*2)
	files := make(chan byteSearchFileResult, workers*2)
	var workerWait sync.WaitGroup
	for range workers {
		workerWait.Add(1)
		go byteSearchWorker(searchCtx, w, index, maxLength, jobs, files, &workerWait)
	}

	traversal := make(chan struct {
		result Result
		err    error
	}, 1)
	go func() {
		walkResult, walkErr := w.enqueueByteSearch(searchCtx, target, query, jobs)
		close(jobs)
		workerWait.Wait()
		close(files)
		traversal <- struct {
			result Result
			err    error
		}{walkResult, walkErr}
	}()

	for file := range files {
		result.CandidateFileCount++
		if file.err != nil {
			if errors.Is(file.err, context.Canceled) {
				continue
			}
			result.FileErrorCount++
			if len(result.FileErrors) < DefaultRetainedErrors {
				result.FileErrors = append(result.FileErrors, PathError{Path: file.path, Err: file.err})
			} else {
				result.ErrorsTruncated = true
			}
			continue
		}
		result.ScannedFileCount++
		if len(file.matched) == 0 {
			continue
		}
		for _, target := range file.matched {
			result.Matches = append(result.Matches, ByteSearchMatch{Path: file.path, Target: target})
		}
	}
	walked := <-traversal
	result.Traversal = walked.result
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if walked.err != nil {
		return result, walked.err
	}
	return result, nil
}

func (w *Walker) enqueueByteSearch(ctx context.Context, target boundTarget, query ByteSearchQuery,
	jobs chan<- byteSearchJob) (Result, error) {
	sequence := uint64(0)
	enqueue := func(entry Metadata, absolute string) error {
		if entry.IsDir || entry.IsSymlink || entry.Restricted || !entry.IsRegular {
			return nil
		}
		if query.SelectFile != nil && !query.SelectFile(entry) {
			return nil
		}
		job := byteSearchJob{sequence: sequence, entry: entry, absolute: absolute}
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
	request := newWalkRequest(w.root, target.absolute, target.relative, WalkOptions{SortEntries: true})
	return walkWithPath(ctx, request, enqueue)
}

func byteSearchWorker(ctx context.Context, walker *Walker, index map[byte][][]byte, maxLength int,
	jobs <-chan byteSearchJob, results chan<- byteSearchFileResult, wait *sync.WaitGroup) {
	defer wait.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-jobs:
			if !ok {
				return
			}
			file, _, openErr := walker.openBoundRegular(ctx, job.absolute)
			if openErr != nil {
				select {
				case results <- byteSearchFileResult{sequence: job.sequence, path: job.entry.Path, err: openErr}:
				case <-ctx.Done():
					return
				}
				continue
			}
			matched, scanErr := scanByteTargets(ctx, file, index, maxLength)
			file.Close()
			select {
			case results <- byteSearchFileResult{sequence: job.sequence, path: job.entry.Path, matched: matched, err: scanErr}:
			case <-ctx.Done():
				return
			}
		}
	}
}

func buildByteTargetIndex(targets []string) (map[byte][][]byte, int) {
	index := make(map[byte][][]byte)
	seen := make(map[string]struct{}, len(targets))
	maxLength := 0
	for _, target := range targets {
		if target == "" {
			continue
		}
		if _, exists := seen[target]; exists {
			continue
		}
		seen[target] = struct{}{}
		pattern := []byte(target)
		index[pattern[0]] = append(index[pattern[0]], pattern)
		if len(pattern) > maxLength {
			maxLength = len(pattern)
		}
	}
	return index, maxLength
}

func scanByteTargets(ctx context.Context, reader io.Reader, index map[byte][][]byte, maxLength int) ([]string, error) {
	var bitmap [256]bool
	for firstByte := range index {
		bitmap[firstByte] = true
	}
	found := make(map[string]struct{})
	buffer := make([]byte, 64*1024)
	var tail []byte
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		count, readErr := reader.Read(buffer)
		if count > 0 {
			data := make([]byte, len(tail)+count)
			copy(data, tail)
			copy(data[len(tail):], buffer[:count])
			for indexAt := 0; indexAt < len(data); {
				for indexAt < len(data) && !bitmap[data[indexAt]] {
					indexAt++
				}
				if indexAt >= len(data) {
					break
				}
				for _, pattern := range index[data[indexAt]] {
					if indexAt+len(pattern) <= len(data) &&
						bytes.Equal(pattern, data[indexAt:indexAt+len(pattern)]) {
						found[string(pattern)] = struct{}{}
					}
				}
				indexAt++
			}
			if maxLength > 1 {
				keep := maxLength - 1
				if len(data) > keep {
					tail = append(tail[:0], data[len(data)-keep:]...)
				} else {
					tail = append(tail[:0], data...)
				}
			} else {
				tail = nil
			}
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				break
			}
			return nil, readErr
		}
	}
	if len(found) == 0 {
		return nil, nil
	}
	matched := make([]string, 0, len(found))
	for target := range found {
		matched = append(matched, target)
	}
	return matched, nil
}
