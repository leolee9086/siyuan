//go:build windows

package symlinkfixture

import (
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

var createSymbolicLinkPrivilegeMu sync.Mutex

func enableCreateSymbolicLinkPrivilege() (func() error, error) {
	createSymbolicLinkPrivilegeMu.Lock()
	var token windows.Token
	if err := windows.OpenProcessToken(windows.CurrentProcess(),
		windows.TOKEN_ADJUST_PRIVILEGES|windows.TOKEN_QUERY, &token); err != nil {
		createSymbolicLinkPrivilegeMu.Unlock()
		return nil, err
	}
	fail := func(err error) (func() error, error) {
		_ = token.Close()
		createSymbolicLinkPrivilegeMu.Unlock()
		return nil, err
	}

	name, err := windows.UTF16PtrFromString("SeCreateSymbolicLinkPrivilege")
	if err != nil {
		return fail(err)
	}
	var luid windows.LUID
	if err = windows.LookupPrivilegeValue(nil, name, &luid); err != nil {
		return fail(err)
	}
	assigned, _, err := tokenPrivilegeAttributes(token, luid)
	if err != nil {
		return fail(err)
	}
	if !assigned {
		return fail(fmt.Errorf("SeCreateSymbolicLinkPrivilege is absent from the current process token"))
	}

	requested := windows.Tokenprivileges{PrivilegeCount: 1}
	requested.Privileges[0] = windows.LUIDAndAttributes{Luid: luid, Attributes: windows.SE_PRIVILEGE_ENABLED}
	var previous windows.Tokenprivileges
	var previousBytes uint32
	if err = windows.AdjustTokenPrivileges(token, false, &requested, uint32(unsafe.Sizeof(previous)),
		&previous, &previousBytes); err != nil {
		return fail(err)
	}
	restorePrevious := func() error {
		if previous.PrivilegeCount == 0 {
			return nil
		}
		return windows.AdjustTokenPrivileges(token, false, &previous, 0, nil, nil)
	}
	assigned, attributes, err := tokenPrivilegeAttributes(token, luid)
	if err != nil || !assigned || attributes&windows.SE_PRIVILEGE_ENABLED == 0 {
		if err == nil {
			err = fmt.Errorf("SeCreateSymbolicLinkPrivilege remained disabled")
		}
		_ = restorePrevious()
		return fail(err)
	}

	return func() error {
		restoreErr := restorePrevious()
		closeErr := token.Close()
		createSymbolicLinkPrivilegeMu.Unlock()
		if restoreErr != nil {
			return restoreErr
		}
		return closeErr
	}, nil
}

func tokenPrivilegeAttributes(token windows.Token, expected windows.LUID) (bool, uint32, error) {
	var size uint32
	_ = windows.GetTokenInformation(token, windows.TokenPrivileges, nil, 0, &size)
	if size == 0 {
		return false, 0, fmt.Errorf("query process token privileges returned an empty buffer")
	}
	buffer := make([]byte, size)
	if err := windows.GetTokenInformation(token, windows.TokenPrivileges, &buffer[0], size, &size); err != nil {
		return false, 0, err
	}
	privileges := (*windows.Tokenprivileges)(unsafe.Pointer(&buffer[0])).AllPrivileges()
	for _, privilege := range privileges {
		if privilege.Luid.LowPart == expected.LowPart && privilege.Luid.HighPart == expected.HighPart {
			return true, privilege.Attributes, nil
		}
	}
	return false, 0, nil
}

func verifySymbolicLink(path string) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink == 0 {
		return fmt.Errorf("path is not a symbolic link: mode=%v", info.Mode())
	}
	pointer, err := windows.UTF16PtrFromString(longPath(path))
	if err != nil {
		return err
	}
	handle, err := windows.CreateFile(pointer, windows.FILE_READ_ATTRIBUTES,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil,
		windows.OPEN_EXISTING, windows.FILE_FLAG_OPEN_REPARSE_POINT|windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(handle)
	buffer := make([]byte, windows.MAXIMUM_REPARSE_DATA_BUFFER_SIZE)
	var returned uint32
	if err = windows.DeviceIoControl(handle, windows.FSCTL_GET_REPARSE_POINT, nil, 0,
		&buffer[0], uint32(len(buffer)), &returned, nil); err != nil {
		return err
	}
	if returned < 8 {
		return fmt.Errorf("reparse data is too short: %d", returned)
	}
	tag := binary.LittleEndian.Uint32(buffer[:4])
	if tag != windows.IO_REPARSE_TAG_SYMLINK {
		return unexpectedReparseTag(tag)
	}
	return nil
}

func longPath(path string) string {
	clean := filepath.Clean(path)
	if strings.HasPrefix(clean, `\\?\`) {
		return clean
	}
	if strings.HasPrefix(clean, `\\`) {
		return `\\?\UNC\` + strings.TrimPrefix(clean, `\\`)
	}
	return `\\?\` + clean
}
