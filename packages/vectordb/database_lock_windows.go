//go:build windows

package vectordb

import (
	"errors"
	"os"

	"golang.org/x/sys/windows"
)

func tryLockDatabaseFile(file *os.File) (bool, error) {
	overlapped := new(windows.Overlapped)
	err := windows.LockFileEx(windows.Handle(file.Fd()), windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, overlapped)
	if errors.Is(err, windows.ERROR_LOCK_VIOLATION) || errors.Is(err, windows.ERROR_IO_PENDING) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func unlockDatabaseFile(file *os.File) error {
	return windows.UnlockFileEx(windows.Handle(file.Fd()), 0, 1, 0, new(windows.Overlapped))
}
