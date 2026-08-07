//go:build !windows

package fswalk

import (
	"os"
	"path/filepath"
)

func verifyOpenedFileWithinRoot(root string, file *os.File) error {
	resolved, err := filepath.EvalSymlinks(file.Name())
	if err != nil {
		return err
	}
	if !sameOrWithin(root, resolved) {
		return ErrPathTraversal
	}
	return nil
}
