//go:build !windows

package fswalk

import "path/filepath"

func resolvePathTarget(path string) (string, error) {
	return filepath.EvalSymlinks(path)
}
