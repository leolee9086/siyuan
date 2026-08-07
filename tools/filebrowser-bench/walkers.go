package main

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"

	"github.com/bmatcuk/doublestar/v4"
	"github.com/charlievieth/fastwalk"
	"github.com/karrick/godirwalk"
	"github.com/saracen/walker"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

func goImplementations() []walkImplementation {
	workers := runtime.GOMAXPROCS(0) * 2
	if workers < 4 {
		workers = 4
	}
	if workers > 32 {
		workers = 32
	}
	return []walkImplementation{
		{Name: "sforge-native", Version: runtime.Version(), Run: runNative(0)},
		{Name: "sforge-native-12", Version: runtime.Version(), Run: runNative(12)},
		{Name: "sforge-native-18", Version: runtime.Version(), Run: runNative(18)},
		{Name: "sforge-native-24", Version: runtime.Version(), Run: runNative(24)},
		{Name: "sforge-native-32", Version: runtime.Version(), Run: runNative(32)},
		{Name: "filepath-walkdir", Version: runtime.Version(), Run: runFilepathWalkDir},
		{Name: "filepath-walk", Version: runtime.Version(), Run: runFilepathWalk},
		{Name: "godirwalk-default", Version: "v1.17.0", Run: runGodirwalk(false)},
		{Name: "godirwalk-unsorted", Version: "v1.17.0", Run: runGodirwalk(true)},
		{Name: "fastwalk-default", Version: "v1.0.14", Run: runFastwalk(0)},
		{Name: "fastwalk-tuned", Version: "v1.0.14", Run: runFastwalk(workers)},
		{Name: "saracen-walker-default", Version: "v0.1.4", Run: runSaracen(0)},
		{Name: "saracen-walker-tuned", Version: "v0.1.4", Run: runSaracen(workers)},
		{Name: "doublestar-globwalk", Version: "v4.10.0", Run: runDoublestar},
	}
}

func runNative(workers int) func(context.Context, string, bool) (snapshot, error) {
	return func(ctx context.Context, root string, digest bool) (snapshot, error) {
		service := filebrowser.NewService(root, func() (map[string]*agent.TaskDirectoryBinding, error) {
			return nil, nil
		})
		acc := newAccumulator(root, digest)
		visitor := func(entry filebrowser.WalkEntry) error {
			acc.addRelative(entry.Path, entry.IsDir)
			return ctx.Err()
		}
		result, err := service.ScanContext(ctx, filebrowser.ScanRequest{RootID: "workspace", Workers: workers}, visitor)
		value := acc.snapshot(digest)
		value.Errors = uint64(result.ErrorCount)
		value.ErrorsKnown = true
		return value, err
	}
}

func runFilepathWalkDir(ctx context.Context, root string, digest bool) (snapshot, error) {
	acc := newAccumulator(root, digest)
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if walkErr != nil {
			acc.addError()
			return nil
		}
		acc.addAbsolute(path, entry.IsDir())
		return nil
	})
	return acc.snapshot(true), err
}

func runFilepathWalk(ctx context.Context, root string, digest bool) (snapshot, error) {
	acc := newAccumulator(root, digest)
	err := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if walkErr != nil {
			acc.addError()
			return nil
		}
		acc.addAbsolute(path, info.IsDir())
		return nil
	})
	return acc.snapshot(true), err
}

func runGodirwalk(unsorted bool) func(context.Context, string, bool) (snapshot, error) {
	return func(ctx context.Context, root string, digest bool) (snapshot, error) {
		acc := newAccumulator(root, digest)
		err := godirwalk.Walk(root, &godirwalk.Options{
			Unsorted: unsorted, FollowSymbolicLinks: false,
			Callback: func(path string, entry *godirwalk.Dirent) error {
				if err := ctx.Err(); err != nil {
					return err
				}
				acc.addAbsolute(path, entry.IsDir())
				return nil
			},
			ErrorCallback: func(string, error) godirwalk.ErrorAction {
				acc.addError()
				return godirwalk.SkipNode
			},
		})
		return acc.snapshot(true), err
	}
}

func runFastwalk(workers int) func(context.Context, string, bool) (snapshot, error) {
	return func(ctx context.Context, root string, digest bool) (snapshot, error) {
		acc := newAccumulator(root, digest)
		config := &fastwalk.Config{Follow: false, NumWorkers: workers, Sort: fastwalk.SortNone}
		err := fastwalk.Walk(config, root, func(path string, entry fs.DirEntry, walkErr error) error {
			if err := ctx.Err(); err != nil {
				return err
			}
			if walkErr != nil {
				acc.addError()
				return nil
			}
			acc.addAbsolute(path, entry.IsDir())
			return nil
		})
		return acc.snapshot(true), err
	}
}

func runSaracen(limit int) func(context.Context, string, bool) (snapshot, error) {
	return func(ctx context.Context, root string, digest bool) (snapshot, error) {
		acc := newAccumulator(root, digest)
		options := []walker.Option{walker.WithErrorCallback(func(string, error) error {
			acc.addError()
			return nil
		})}
		if limit > 0 {
			options = append(options, walker.WithLimit(limit))
		}
		err := walker.WalkWithContext(ctx, root, func(path string, info os.FileInfo) error {
			acc.addAbsolute(path, info.IsDir())
			return ctx.Err()
		}, options...)
		return acc.snapshot(true), err
	}
}

func runDoublestar(ctx context.Context, root string, digest bool) (snapshot, error) {
	acc := newAccumulator(root, digest)
	err := doublestar.GlobWalk(os.DirFS(root), "**", func(path string, entry fs.DirEntry) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		acc.addRelative(path, entry.IsDir())
		return nil
	}, doublestar.WithNoFollow())
	return acc.snapshot(false), err
}
