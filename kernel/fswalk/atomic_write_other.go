//go:build !windows

package fswalk

import "os"

func replaceFile(temporary, target string) error { return os.Rename(temporary, target) }

func syncParentDirectory(directory string) error {
	file, err := os.Open(directory)
	if err != nil {
		return err
	}
	defer file.Close()
	return file.Sync()
}
