//go:build !windows

package fswalk

import (
	"context"
	"os"
	"strings"
	"sync"
)

func readDirectorySnapshotContext(ctx context.Context, directory string) ([]Metadata, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	items, err := os.ReadDir(directory)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []Metadata{}, nil
	}

	entries := make([]Metadata, len(items))
	valid := make([]bool, len(items))
	jobs := make(chan int)
	var workers sync.WaitGroup
	var firstErr error
	var errMu sync.Mutex
	workerCount := RecommendedWorkers(len(items))
	for range workerCount {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for index := range jobs {
				if ctx.Err() != nil {
					continue
				}
				item := items[index]
				info, infoErr := item.Info()
				if infoErr != nil {
					errMu.Lock()
					if firstErr == nil {
						firstErr = infoErr
					}
					errMu.Unlock()
					continue
				}
				entries[index] = Metadata{
					Name: item.Name(), IsDir: info.IsDir(),
					IsSymlink: item.Type()&os.ModeSymlink != 0,
					IsRegular: info.Mode().IsRegular(),
					Hidden:    strings.HasPrefix(item.Name(), "."),
					Size:      info.Size(), Updated: info.ModTime().Unix(),
				}
				valid[index] = true
			}
		}()
	}
	for index := range items {
		select {
		case jobs <- index:
		case <-ctx.Done():
			close(jobs)
			workers.Wait()
			return nil, ctx.Err()
		}
	}
	close(jobs)
	workers.Wait()
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	if firstErr != nil {
		return nil, firstErr
	}

	result := make([]Metadata, 0, len(items))
	for index, entry := range entries {
		if valid[index] {
			result = append(result, entry)
		}
	}
	return result, nil
}
