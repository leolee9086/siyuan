package fswalk

import (
	"context"
	"os"
)

// RemoveEmpty 删除绑定根内的文件或空目录，不递归删除。
func (w *Walker) RemoveEmpty(ctx context.Context, relative string) error {
	absolute, _, err := w.boundPath(ctx, relative, false)
	if err != nil {
		return err
	}
	info, err := os.Lstat(absolute)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return ErrPathTraversal
	}
	if info.IsDir() {
		entries, readErr := os.ReadDir(absolute)
		if readErr != nil {
			return readErr
		}
		if len(entries) != 0 {
			return ErrDirectoryNotEmpty
		}
	} else if !info.Mode().IsRegular() {
		return ErrNotRegularFile
	}
	if err = validateBoundPathComponents(ctx, w.root, absolute, false); err != nil {
		return err
	}
	return os.Remove(absolute)
}
