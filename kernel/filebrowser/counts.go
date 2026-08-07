package filebrowser

import (
	"context"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

type directoryCountJob struct {
	index int
	path  string
}

// populateChildCounts scans only directory entries in the returned page with bounded fan-out.
func populateChildCounts(ctx context.Context, root Root, entries []Entry) {
	jobs := make([]directoryCountJob, 0, len(entries))
	for index := range entries {
		if entries[index].IsDir && !entries[index].Restricted {
			jobs = append(jobs, directoryCountJob{index: index, path: entries[index].Path})
		}
	}
	walker, err := fswalk.New(root.Path)
	if err != nil {
		return
	}
	queue := make(chan directoryCountJob)
	var workers sync.WaitGroup
	for range boundedIOWorkers(len(jobs)) {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for job := range queue {
				files, directories, err := countImmediateEntries(ctx, walker, job.path)
				if err != nil {
					continue
				}
				entries[job.index].ChildFileCount = files
				entries[job.index].ChildDirectoryCount = directories
				entries[job.index].ChildCountKnown = true
			}
		}()
	}
	for _, job := range jobs {
		select {
		case queue <- job:
		case <-ctx.Done():
			close(queue)
			workers.Wait()
			return
		}
	}
	close(queue)
	workers.Wait()
}

func countImmediateEntries(ctx context.Context, walker *fswalk.Walker, relative string) (files, directories int, err error) {
	items, err := walker.ReadDirectory(ctx, relative, false)
	if err != nil {
		return 0, 0, err
	}
	for _, item := range items {
		if err = ctx.Err(); err != nil {
			return 0, 0, err
		}
		if item.IsDir {
			directories++
		} else {
			files++
		}
	}
	return files, directories, nil
}
