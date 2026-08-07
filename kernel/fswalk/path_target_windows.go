//go:build windows

package fswalk

import (
	"path/filepath"
	"strings"

	"golang.org/x/sys/windows"
)

func resolvePathTarget(path string) (string, error) {
	pathPointer, err := windows.UTF16PtrFromString(longWindowsPath(path))
	if err != nil {
		return "", err
	}
	handle, err := windows.CreateFile(pathPointer, windows.FILE_READ_ATTRIBUTES,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil,
		windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(handle)

	bufferSize := uint32(512)
	for {
		buffer := make([]uint16, bufferSize)
		length, finalErr := windows.GetFinalPathNameByHandle(handle, &buffer[0], bufferSize, 0)
		if finalErr != nil {
			return "", finalErr
		}
		if length < bufferSize {
			return filepath.Clean(normalizeFinalWindowsPath(windows.UTF16ToString(buffer[:length]))), nil
		}
		bufferSize = length + 1
	}
}

func normalizeFinalWindowsPath(path string) string {
	if strings.HasPrefix(path, `\\?\UNC\`) {
		return `\\` + strings.TrimPrefix(path, `\\?\UNC\`)
	}
	return strings.TrimPrefix(path, `\\?\`)
}
