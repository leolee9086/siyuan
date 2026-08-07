//go:build !windows

package fswalk

import "os"

func createGrepContractDirectoryReparse(target, link string) error {
	return os.Symlink(target, link)
}

func grepContractReparseKind(path string) (string, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return "symbolic-link", nil
	}
	return "none", nil
}
