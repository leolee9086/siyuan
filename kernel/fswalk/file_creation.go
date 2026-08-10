package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
)

// CreateFile creates one empty regular file below an existing bound
// directory. It never creates missing parents and never replaces an existing
// entry; content uploads use the separate streaming write primitive.
func (w *Walker) CreateFile(ctx context.Context, relative string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	absolute, clean, err := w.boundPath(ctx, relative, true)
	if err != nil {
		return err
	}
	if clean == "" {
		return ErrRootMutation
	}
	parent := filepath.Dir(absolute)
	if err = validateBoundPathComponents(ctx, w.root, parent, false); err != nil {
		return err
	}
	parentInfo, err := os.Lstat(parent)
	if err != nil {
		return err
	}
	if !parentInfo.IsDir() {
		return ErrPathComponentNotDirectory
	}

	file, err := os.OpenFile(absolute, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		if errors.Is(err, os.ErrExist) {
			return ErrPathExists
		}
		return err
	}
	if closeErr := file.Close(); closeErr != nil {
		return closeErr
	}
	created, err := os.Lstat(absolute)
	if err != nil {
		return err
	}
	linkLike, err := pathComponentIsLinkLike(absolute, created)
	if err != nil {
		return err
	}
	if linkLike {
		return ErrPathTraversal
	}
	if !created.Mode().IsRegular() {
		return ErrNotRegularFile
	}
	resolved, err := resolvePathTarget(absolute)
	if err != nil || !sameOrWithin(w.root, resolved) {
		return ErrPathTraversal
	}
	return syncParentDirectory(parent)
}
