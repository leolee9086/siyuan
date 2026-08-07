package filebrowser

import (
	"context"
	"errors"
	"path/filepath"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

type directorySnapshotEntry = fswalk.Metadata

func adaptFSWalkError(err error) error {
	switch {
	case errors.Is(err, fswalk.ErrPathTraversal):
		return ErrPathTraversal
	case errors.Is(err, fswalk.ErrRootUnavailable), errors.Is(err, fswalk.ErrStartUnavailable):
		return ErrRootUnavailable
	default:
		return err
	}
}

func readDirectorySnapshot(directory string) ([]directorySnapshotEntry, error) {
	walker, err := fswalk.New(directory)
	if err != nil {
		return nil, err
	}
	return walker.ReadDirectory(context.Background(), "", false)
}

func boundedIOWorkers(jobCount int) int { return fswalk.RecommendedWorkers(jobCount) }

// resolvePathTarget 属于授权根解析阶段；进入 fswalk.New 后仅使用相对路径接口。
func resolvePathTarget(path string) (string, error) { return filepath.EvalSymlinks(path) }
