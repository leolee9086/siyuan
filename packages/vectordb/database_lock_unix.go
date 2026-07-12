//go:build aix || android || darwin || dragonfly || freebsd || illumos || ios || linux || netbsd || openbsd || solaris

package vectordb

import (
	"errors"
	"os"

	"golang.org/x/sys/unix"
)

func tryLockDatabaseFile(file *os.File) (bool, error) {
	err := unix.Flock(int(file.Fd()), unix.LOCK_EX|unix.LOCK_NB)
	if errors.Is(err, unix.EWOULDBLOCK) || errors.Is(err, unix.EAGAIN) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func unlockDatabaseFile(file *os.File) error {
	return unix.Flock(int(file.Fd()), unix.LOCK_UN)
}
