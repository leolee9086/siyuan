package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
)

// CreateDirectory creates exactly one directory below a bound root.
// Missing parents are rejected so callers cannot accidentally materialize a
// path outside the directory operation they presented to the user.
func (w *Walker) CreateDirectory(ctx context.Context, relative string) error {
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
	if existing, statErr := os.Lstat(absolute); statErr == nil {
		if linkLike, linkErr := pathComponentIsLinkLike(absolute, existing); linkErr != nil {
			return linkErr
		} else if linkLike {
			return ErrPathTraversal
		}
		return ErrPathExists
	} else if !os.IsNotExist(statErr) {
		return statErr
	}
	if err = os.Mkdir(absolute, 0755); err != nil {
		if errors.Is(err, os.ErrExist) {
			return ErrPathExists
		}
		return err
	}
	created, err := os.Lstat(absolute)
	if err != nil {
		return err
	}
	if linkLike, linkErr := pathComponentIsLinkLike(absolute, created); linkErr != nil {
		return linkErr
	} else if linkLike {
		return ErrPathTraversal
	}
	if !created.IsDir() {
		return ErrPathComponentNotDirectory
	}
	resolved, err := resolvePathTarget(absolute)
	if err != nil || !sameOrWithin(w.root, resolved) {
		return ErrPathTraversal
	}
	return syncParentDirectory(parent)
}

// Rename changes one bound entry's name without replacing an existing target.
// The filebrowser domain restricts this to a single parent directory; Walker
// keeps the more general root-relative primitive for other local callers.
func (w *Walker) Rename(ctx context.Context, sourceRelative, destinationRelative string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	source, err := w.resolveTarget(sourceRelative)
	if err != nil {
		return err
	}
	if source.relative == "" {
		return ErrRootMutation
	}
	destinationAbsolute, destinationClean, err := w.resolveCopyDestination(destinationRelative)
	if err != nil {
		return err
	}
	if destinationClean == "" {
		return ErrRootMutation
	}
	if filepath.Clean(source.absolute) == filepath.Clean(destinationAbsolute) {
		return nil
	}
	if copyPathsOverlap(source.absolute, source.info.IsDir(), destinationAbsolute) {
		return ErrMovePathOverlap
	}
	if existing, statErr := os.Lstat(destinationAbsolute); statErr == nil {
		if linkLike, linkErr := pathComponentIsLinkLike(destinationAbsolute, existing); linkErr != nil {
			return linkErr
		} else if linkLike {
			return ErrPathTraversal
		}
		return ErrPathExists
	} else if !os.IsNotExist(statErr) {
		return statErr
	}
	destinationParent := filepath.Dir(destinationAbsolute)
	if err = validateBoundPathComponents(ctx, w.root, destinationParent, false); err != nil {
		return err
	}
	if err = os.Rename(source.absolute, destinationAbsolute); err != nil {
		if errors.Is(err, os.ErrExist) {
			return ErrPathExists
		}
		return err
	}
	if err = syncParentDirectory(destinationParent); err != nil {
		return err
	}
	sourceParent := filepath.Dir(source.absolute)
	if sourceParent != destinationParent {
		if err = syncParentDirectory(sourceParent); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}
