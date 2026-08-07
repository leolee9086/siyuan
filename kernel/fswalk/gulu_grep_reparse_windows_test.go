//go:build windows

package fswalk

import (
	"encoding/binary"
	"fmt"
	"os/exec"

	"golang.org/x/sys/windows"
)

func createGrepContractDirectoryReparse(target, link string) error {
	output, err := exec.Command("cmd.exe", "/d", "/c", "mklink", "/J", link, target).CombinedOutput()
	if err != nil {
		return fmt.Errorf("create junction: %w: %s", err, output)
	}
	return nil
}

func grepContractReparseKind(path string) (string, error) {
	pointer, err := windows.UTF16PtrFromString(longWindowsPath(path))
	if err != nil {
		return "", err
	}
	handle, err := windows.CreateFile(pointer, windows.FILE_READ_ATTRIBUTES,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil,
		windows.OPEN_EXISTING, windows.FILE_FLAG_OPEN_REPARSE_POINT|windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(handle)
	buffer := make([]byte, windows.MAXIMUM_REPARSE_DATA_BUFFER_SIZE)
	var returned uint32
	if err = windows.DeviceIoControl(handle, windows.FSCTL_GET_REPARSE_POINT, nil, 0,
		&buffer[0], uint32(len(buffer)), &returned, nil); err != nil {
		return "", err
	}
	switch binary.LittleEndian.Uint32(buffer[:4]) {
	case windows.IO_REPARSE_TAG_SYMLINK:
		return "symbolic-link", nil
	case windows.IO_REPARSE_TAG_MOUNT_POINT:
		return "junction", nil
	default:
		return "other-reparse", nil
	}
}
