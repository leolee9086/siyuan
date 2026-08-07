//go:build windows

package filebrowser

import (
	"os"
	"syscall"
)

func fileCreationTime(info os.FileInfo) int64 {
	data, ok := info.Sys().(*syscall.Win32FileAttributeData)
	if !ok || data == nil {
		return 0
	}
	return data.CreationTime.Nanoseconds() / int64(1e9)
}
