//go:build !windows && !darwin

package filebrowser

import "os"

func fileCreationTime(_ os.FileInfo) int64 {
	return 0
}
