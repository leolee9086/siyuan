//go:build windows

package fswalk

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

func verifyOpenedFileWithinRoot(root string, file *os.File) error {
	bufferSize := uint32(512)
	for {
		buffer := make([]uint16, bufferSize)
		length, err := windows.GetFinalPathNameByHandle(windows.Handle(file.Fd()), &buffer[0], bufferSize, 0)
		if err != nil {
			return err
		}
		if length < bufferSize {
			resolved := filepath.Clean(normalizeFinalWindowsPath(windows.UTF16ToString(buffer[:length])))
			if !sameOrWithin(root, resolved) {
				return ErrPathTraversal
			}
			return nil
		}
		bufferSize = length + 1
	}
}
