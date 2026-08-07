package fswalk

import (
	"context"
	"errors"
	"io/fs"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type directoryJob struct {
	sequence uint64
	absolute string
	relative string
	depth    int
}

type directoryResult struct {
	job     directoryJob
	entries []Metadata
	err     error
}

type walker struct {
	request walkRequest
	result  Result
	visitor func(Metadata, string) error
	nextSeq uint64
}

// walk 并发读取目录，但把回调、计数、停止条件和错误提交串行化。
func walk(ctx context.Context, request walkRequest, visitor Visitor) (Result, error) {
	var internal func(Metadata, string) error
	if visitor != nil {
		internal = func(entry Metadata, _ string) error { return visitor(entry) }
	}
	return walkWithPath(ctx, request, internal)
}

// walkWithPath 仅供 fswalk 内部的内容工作流使用。绝对路径不会离开本包。
func walkWithPath(ctx context.Context, request walkRequest, visitor func(Metadata, string) error) (Result, error) {
	if err := ctx.Err(); err != nil {
		return Result{}, err
	}
	w := walker{request: request, visitor: visitor, result: Result{
		Path: request.path, Errors: []PathError{},
	}}
	entries, err := readDirectorySnapshotContext(ctx, request.directory)
	if err != nil {
		return w.finish(), err
	}
	w.result.ScannedDirectoryCount = 1
	jobs, stop, err := w.consume(ctx, entries, request.directory, request.path, 1)
	if err != nil {
		return w.finish(), err
	}
	if stop || len(jobs) == 0 {
		return w.finish(), nil
	}
	return w.run(ctx, jobs)
}

func (w *walker) consume(ctx context.Context, entries []Metadata, parent, parentRelative string,
	depth int) ([]directoryJob, bool, error) {
	if w.request.sort {
		sortMetadata(entries)
	}
	children := make([]directoryJob, 0)
	for _, item := range entries {
		if err := ctx.Err(); err != nil {
			return children, true, err
		}
		if w.request.maxEntries > 0 && w.result.EntryCount >= w.request.maxEntries {
			w.result.EntryLimitReached = true
			return children, true, nil
		}
		entry := Metadata{
			Name: item.Name, Path: joinRelative(parentRelative, item.Name),
			IsDir: item.IsDir, IsSymlink: item.IsSymlink, IsRegular: item.IsRegular,
			Restricted: item.Restricted, Hidden: item.Hidden,
			Size: item.Size, Updated: item.Updated, Depth: depth,
		}
		entry = classifyMetadata(w.request.root, parent, entry)
		w.result.EntryCount++
		if entry.IsDir {
			w.result.DirectoryCount++
		} else {
			w.result.FileCount++
		}

		if w.visitor != nil {
			visitErr := w.visitor(entry, filepath.Join(parent, item.Name))
			switch {
			case visitErr == nil:
			case errors.Is(visitErr, fs.SkipAll):
				w.result.Stopped = true
				return children, true, nil
			case errors.Is(visitErr, fs.SkipDir):
				if !entry.IsDir {
					return children, true, nil
				}
				continue
			default:
				return children, true, visitErr
			}
		}
		if entry.IsDir && !entry.IsSymlink {
			if w.request.maxDepth > 0 && depth >= w.request.maxDepth {
				w.result.DepthLimitReached = true
				continue
			}
			children = append(children, directoryJob{
				sequence: w.nextSeq,
				absolute: filepath.Join(parent, item.Name),
				relative: entry.Path,
				depth:    depth,
			})
			w.nextSeq++
		}
	}
	return children, false, nil
}

func (w *walker) run(ctx context.Context, initial []directoryJob) (Result, error) {
	workers := normalizeWorkers(w.request.workers)
	if len(initial) < workers {
		workers = len(initial)
	}
	if workers < 1 {
		workers = 1
	}
	walkCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan directoryJob)
	results := make(chan directoryResult, workers)
	var wait sync.WaitGroup
	for range workers {
		wait.Add(1)
		go directoryWorker(walkCtx, jobs, results, &wait)
	}
	queue := jobQueue{items: initial}
	pending := map[uint64]directoryResult{}
	nextCommit := uint64(0)
	inFlight := 0
	for queue.len() > 0 || inFlight > 0 {
		if err := ctx.Err(); err != nil {
			cancelAndWait(cancel, jobs, &wait)
			return w.finish(), err
		}
		var send chan<- directoryJob
		var next directoryJob
		if queue.len() > 0 && inFlight < workers {
			send = jobs
			next = queue.front()
		}
		select {
		case send <- next:
			queue.pop()
			inFlight++
		case completed := <-results:
			inFlight--
			if w.request.sort {
				pending[completed.job.sequence] = completed
				var stop bool
				var err error
				for {
					ready, ok := pending[nextCommit]
					if !ok {
						break
					}
					delete(pending, nextCommit)
					nextCommit++
					w.result.ScannedDirectoryCount++
					if ready.err != nil {
						w.addError(ready.job.relative, ready.err)
						if w.request.stopOnError {
							cancelAndWait(cancel, jobs, &wait)
							return w.finish(), PathError{Path: ready.job.relative, Err: ready.err}
						}
						continue
					}
					var children []directoryJob
					children, stop, err = w.consume(ctx, ready.entries, ready.job.absolute,
						ready.job.relative, ready.job.depth+1)
					queue.push(children)
					if err != nil || stop {
						break
					}
				}
				if err != nil {
					cancelAndWait(cancel, jobs, &wait)
					return w.finish(), err
				}
				if stop {
					cancelAndWait(cancel, jobs, &wait)
					return w.finish(), nil
				}
			} else {
				w.result.ScannedDirectoryCount++
				if completed.err != nil {
					w.addError(completed.job.relative, completed.err)
					if w.request.stopOnError {
						cancelAndWait(cancel, jobs, &wait)
						return w.finish(), PathError{Path: completed.job.relative, Err: completed.err}
					}
					continue
				}
				children, stop, err := w.consume(ctx, completed.entries, completed.job.absolute,
					completed.job.relative, completed.job.depth+1)
				queue.push(children)
				if err != nil {
					cancelAndWait(cancel, jobs, &wait)
					return w.finish(), err
				}
				if stop {
					cancelAndWait(cancel, jobs, &wait)
					return w.finish(), nil
				}
			}
		case <-ctx.Done():
			cancelAndWait(cancel, jobs, &wait)
			return w.finish(), ctx.Err()
		}
	}
	close(jobs)
	wait.Wait()
	if err := ctx.Err(); err != nil {
		return w.finish(), err
	}
	return w.finish(), nil
}

func directoryWorker(ctx context.Context, jobs <-chan directoryJob, results chan<- directoryResult,
	wait *sync.WaitGroup) {
	defer wait.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-jobs:
			if !ok {
				return
			}
			entries, err := readDirectorySnapshotContext(ctx, job.absolute)
			select {
			case results <- directoryResult{job: job, entries: entries, err: err}:
			case <-ctx.Done():
				return
			}
		}
	}
}

func (w *walker) addError(relative string, err error) {
	w.result.ErrorCount++
	if len(w.result.Errors) < w.request.maxErrors {
		w.result.Errors = append(w.result.Errors, PathError{Path: relative, Err: err})
	} else {
		w.result.ErrorsTruncated = true
	}
}

func (w *walker) finish() Result {
	w.result.Truncated = w.result.EntryLimitReached || w.result.DepthLimitReached
	return w.result
}

func normalizeWorkers(requested int) int {
	if requested <= 0 {
		return RecommendedWorkers(32)
	}
	if requested > 64 {
		return 64
	}
	return requested
}

func sortMetadata(entries []Metadata) {
	sort.SliceStable(entries, func(left, right int) bool {
		leftName := strings.ToLower(entries[left].Name)
		rightName := strings.ToLower(entries[right].Name)
		if leftName != rightName {
			return leftName < rightName
		}
		return entries[left].Name < entries[right].Name
	})
}

func joinRelative(parent, name string) string {
	if parent == "" || parent == "." {
		return name
	}
	return path.Join(parent, name)
}

type jobQueue struct {
	items []directoryJob
	head  int
}

func (q *jobQueue) len() int { return len(q.items) - q.head }

func (q *jobQueue) front() directoryJob { return q.items[q.head] }

func (q *jobQueue) pop() {
	q.items[q.head] = directoryJob{}
	q.head++
	if q.head >= 4096 && q.head*2 >= len(q.items) {
		q.items = append(q.items[:0], q.items[q.head:]...)
		q.head = 0
	}
}

func (q *jobQueue) push(jobs []directoryJob) { q.items = append(q.items, jobs...) }

func cancelAndWait(cancel context.CancelFunc, jobs chan directoryJob, wait *sync.WaitGroup) {
	cancel()
	close(jobs)
	wait.Wait()
}
