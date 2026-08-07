//go:build !windows

package symlinkfixture

import (
	"fmt"
	"os"
)

func enableCreateSymbolicLinkPrivilege() (func() error, error) {
	return nil, nil
}

func verifySymbolicLink(path string) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink == 0 {
		return fmt.Errorf("path is not a symbolic link: mode=%v", info.Mode())
	}
	return nil
}
