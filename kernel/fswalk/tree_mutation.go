package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
)

// RemoveTreeResult 汇总一次递归删除实际移除的入口。
type RemoveTreeResult struct {
	RemovedFileCount      int
	RemovedDirectoryCount int
}

// RemoveTree 删除绑定根内的一个文件或目录树。绑定根本身和链接入口始终被拒绝。
func (w *Walker) RemoveTree(ctx context.Context, relative string) (RemoveTreeResult, error) {
	if err := ctx.Err(); err != nil {
		return RemoveTreeResult{}, err
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return RemoveTreeResult{}, err
	}
	if target.relative == "" {
		return RemoveTreeResult{}, ErrRootMutation
	}
	plan := make([]removeTreeEntry, 0)
	if err = w.planBoundRemoval(ctx, target.absolute, target.relative, &plan); err != nil {
		return RemoveTreeResult{}, err
	}
	result := RemoveTreeResult{}
	for _, entry := range plan {
		if err = ctx.Err(); err != nil {
			return result, err
		}
		if err = validateBoundPathComponents(ctx, w.root, entry.absolute, false); err != nil {
			return result, PathError{Path: entry.relative, Err: err}
		}
		info, statErr := os.Lstat(entry.absolute)
		if statErr != nil {
			return result, PathError{Path: entry.relative, Err: statErr}
		}
		linkLike, linkErr := pathComponentIsLinkLike(entry.absolute, info)
		if linkErr != nil {
			return result, PathError{Path: entry.relative, Err: linkErr}
		}
		if linkLike || info.IsDir() != entry.directory {
			return result, PathError{Path: entry.relative, Err: ErrPathTraversal}
		}
		if err = os.Remove(entry.absolute); err != nil {
			return result, PathError{Path: entry.relative, Err: err}
		}
		if entry.directory {
			result.RemovedDirectoryCount++
		} else {
			result.RemovedFileCount++
		}
	}
	return result, nil
}

type removeTreeEntry struct {
	absolute  string
	relative  string
	directory bool
}

func (w *Walker) planBoundRemoval(ctx context.Context, absolute, relative string,
	plan *[]removeTreeEntry) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !sameOrWithin(w.root, absolute) {
		return PathError{Path: relative, Err: ErrPathTraversal}
	}
	info, err := os.Lstat(absolute)
	if err != nil {
		return PathError{Path: relative, Err: err}
	}
	linkLike, err := pathComponentIsLinkLike(absolute, info)
	if err != nil {
		return PathError{Path: relative, Err: err}
	}
	if linkLike {
		return PathError{Path: relative, Err: ErrPathTraversal}
	}
	if info.IsDir() {
		entries, readErr := readDirectorySnapshotContext(ctx, absolute)
		if readErr != nil {
			return PathError{Path: relative, Err: readErr}
		}
		sortMetadata(entries)
		for _, entry := range entries {
			if entry.IsSymlink || entry.Restricted {
				return PathError{Path: joinRootRelative(relative, entry.Name), Err: ErrPathTraversal}
			}
			if err = w.planBoundRemoval(ctx, filepath.Join(absolute, entry.Name),
				joinRootRelative(relative, entry.Name), plan); err != nil {
				return err
			}
		}
		*plan = append(*plan, removeTreeEntry{absolute: absolute, relative: relative, directory: true})
		return nil
	}
	if !info.Mode().IsRegular() {
		return PathError{Path: relative, Err: ErrNotRegularFile}
	}
	*plan = append(*plan, removeTreeEntry{absolute: absolute, relative: relative})
	return nil
}

// Move 把一个绑定入口原子移动到目标 Walker 的根相对位置。
func (w *Walker) Move(ctx context.Context, sourceRelative string, destination *Walker,
	destinationRelative string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if destination == nil || destination.root == "" {
		return ErrRootUnavailable
	}
	source, err := w.resolveTarget(sourceRelative)
	if err != nil {
		return err
	}
	if source.relative == "" {
		return ErrRootMutation
	}
	destinationAbsolute, destinationClean, err := destination.resolveCopyDestination(destinationRelative)
	if err != nil {
		return err
	}
	if destinationClean == "" {
		return ErrRootMutation
	}
	if copyPathsOverlap(source.absolute, source.info.IsDir(), destinationAbsolute) {
		return ErrMovePathOverlap
	}
	if existing, statErr := os.Lstat(destinationAbsolute); statErr == nil {
		linkLike, linkErr := pathComponentIsLinkLike(destinationAbsolute, existing)
		if linkErr != nil {
			return linkErr
		}
		if linkLike {
			return ErrPathTraversal
		}
		return ErrPathExists
	} else if !os.IsNotExist(statErr) {
		return statErr
	}
	if _, err = destination.ensureBoundDirectory(ctx, filepath.Dir(destinationAbsolute), 0755); err != nil {
		return err
	}
	if err = validateBoundPathComponents(ctx, w.root, source.absolute, false); err != nil {
		return err
	}
	if err = validateBoundPathComponents(ctx, destination.root, filepath.Dir(destinationAbsolute), false); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	if err = os.Rename(source.absolute, destinationAbsolute); err != nil {
		return err
	}
	if err = syncParentDirectory(filepath.Dir(destinationAbsolute)); err != nil {
		return err
	}
	if filepath.Clean(filepath.Dir(source.absolute)) != filepath.Clean(filepath.Dir(destinationAbsolute)) {
		if err = syncParentDirectory(filepath.Dir(source.absolute)); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}
