package fswalk

import (
	"context"
	"os"
	"path/filepath"
)

func validateBoundPathComponents(ctx context.Context, root, target string, allowMissing bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	root = filepath.Clean(root)
	target = filepath.Clean(target)
	if !sameOrWithin(root, target) {
		return ErrPathTraversal
	}
	relative, err := filepath.Rel(root, target)
	if err != nil || filepath.IsAbs(relative) || relative == ".." {
		return ErrPathTraversal
	}
	current := root
	components := splitRelativePath(relative)
	for index := -1; index < len(components); index++ {
		if err = ctx.Err(); err != nil {
			return err
		}
		if index >= 0 {
			current = filepath.Join(current, components[index])
		}
		info, statErr := os.Lstat(current)
		if statErr != nil {
			if allowMissing && os.IsNotExist(statErr) {
				return nil
			}
			return statErr
		}
		linkLike, linkErr := pathComponentIsLinkLike(current, info)
		if linkErr != nil {
			return linkErr
		}
		if linkLike {
			return ErrPathTraversal
		}
		if index < len(components)-1 && !info.IsDir() {
			return ErrPathComponentNotDirectory
		}
		resolved, resolveErr := resolvePathTarget(current)
		if resolveErr != nil || !sameOrWithin(root, resolved) {
			return ErrPathTraversal
		}
	}
	return nil
}

func splitRelativePath(relative string) []string {
	clean := filepath.Clean(relative)
	if clean == "." || clean == "" {
		return nil
	}
	components := []string{}
	for clean != "." && clean != "" {
		directory, name := filepath.Split(clean)
		components = append([]string{name}, components...)
		clean = filepath.Clean(directory)
	}
	return components
}
