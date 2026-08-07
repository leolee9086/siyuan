//go:build !windows

package fswalk

import "os"

func pathComponentIsLinkLike(_ string, info os.FileInfo) (bool, error) {
	return info.Mode()&os.ModeSymlink != 0, nil
}
