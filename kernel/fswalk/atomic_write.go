package fswalk

import (
	"context"
	"io"
	"os"
	"path/filepath"
)

func (w *Walker) writeAtomic(ctx context.Context, target string, content []byte, mode os.FileMode) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	target = filepath.Clean(target)
	if w == nil || w.root == "" || !sameOrWithin(w.root, target) {
		return ErrPathTraversal
	}
	if err := validateBoundPathComponents(ctx, w.root, filepath.Dir(target), false); err != nil {
		return err
	}
	parent, err := resolvePathTarget(filepath.Dir(target))
	if err != nil || !sameOrWithin(w.root, parent) {
		return ErrPathTraversal
	}
	if existing, statErr := os.Lstat(target); statErr == nil {
		if existing.Mode()&os.ModeSymlink != 0 {
			return ErrPathTraversal
		}
		if !existing.Mode().IsRegular() {
			return ErrNotRegularFile
		}
	} else if statErr != nil && !os.IsNotExist(statErr) {
		return statErr
	}

	temporary, err := os.CreateTemp(parent, ".sforge-write-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err = verifyOpenedFileWithinRoot(w.root, temporary); err == nil {
		err = temporary.Chmod(mode.Perm())
	}
	if err == nil {
		err = writeAllContext(ctx, temporary, content)
	}
	if err == nil {
		err = temporary.Sync()
	}
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if err = replaceFile(temporaryPath, target); err != nil {
		return err
	}
	return syncParentDirectory(parent)
}

func writeAllContext(ctx context.Context, writer io.Writer, content []byte) error {
	for len(content) > 0 {
		if err := ctx.Err(); err != nil {
			return err
		}
		count, err := writer.Write(content)
		if err != nil {
			return err
		}
		if count == 0 {
			return io.ErrShortWrite
		}
		content = content[count:]
	}
	return nil
}
