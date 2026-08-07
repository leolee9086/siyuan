//go:build windows

package fswalk

import "golang.org/x/sys/windows"

func replaceFile(temporary, target string) error {
	from, err := windows.UTF16PtrFromString(longWindowsPath(temporary))
	if err != nil {
		return err
	}
	to, err := windows.UTF16PtrFromString(longWindowsPath(target))
	if err != nil {
		return err
	}
	return windows.MoveFileEx(from, to, windows.MOVEFILE_REPLACE_EXISTING|windows.MOVEFILE_WRITE_THROUGH)
}

func syncParentDirectory(string) error { return nil }
