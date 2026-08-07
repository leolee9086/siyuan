//go:build darwin

package filebrowser

import (
	"os"
	"syscall"
)

func fileCreationTime(info os.FileInfo) int64 {
	data, ok := info.Sys().(*syscall.Stat_t)
	if !ok || data == nil {
		return 0
	}
	return data.Birthtimespec.Sec
}
