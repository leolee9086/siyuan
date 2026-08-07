//go:build windows

package fswalk

import (
	"os"

	"golang.org/x/sys/windows"
)

func pathComponentIsLinkLike(path string, info os.FileInfo) (bool, error) {
	if info.Mode()&os.ModeSymlink != 0 {
		return true, nil
	}
	pointer, err := windows.UTF16PtrFromString(longWindowsPath(path))
	if err != nil {
		return false, err
	}
	attributes, err := windows.GetFileAttributes(pointer)
	if err != nil {
		return false, err
	}
	return attributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0, nil
}
