//go:build windows

package windowssmbmount

import (
	"context"
	"errors"
	"syscall"
	"unsafe"
)

const (
	driveRemote         = 4
	errorMoreData       = syscall.Errno(234)
	errorNotConnected   = syscall.Errno(2250)
	errorConnectionUnav = syscall.Errno(1201)
	errorNoNetwork      = syscall.Errno(1222)
	errorBadNetName     = syscall.Errno(67)
)

type systemMountDiscoverer struct{}

var (
	kernel32DLL           = syscall.NewLazyDLL("kernel32.dll")
	mprDLL                = syscall.NewLazyDLL("mpr.dll")
	getLogicalDrivesProc  = kernel32DLL.NewProc("GetLogicalDrives")
	getDriveTypeProc      = kernel32DLL.NewProc("GetDriveTypeW")
	wnetGetConnectionProc = mprDLL.NewProc("WNetGetConnectionW")
)

func (systemMountDiscoverer) Discover(ctx context.Context) ([]Mount, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	mask, _, callErr := getLogicalDrivesProc.Call()
	if mask == 0 {
		if callErr != syscall.Errno(0) {
			return nil, callErr
		}
		return nil, errors.New("GetLogicalDrives returned no drives")
	}
	result := make([]Mount, 0)
	for index := 0; index < 26; index++ {
		if mask&(1<<uint(index)) == 0 {
			continue
		}
		local := string(rune('A'+index)) + `:\`
		localPtr, err := syscall.UTF16PtrFromString(local)
		if err != nil {
			return nil, err
		}
		driveType, _, _ := getDriveTypeProc.Call(uintptr(unsafe.Pointer(localPtr)))
		if driveType != driveRemote {
			continue
		}
		remote, err := wnetRemoteName(localPtr)
		if err != nil {
			if isDisconnected(err) {
				continue
			}
			return nil, err
		}
		result = append(result, Mount{LocalName: local[:2], RemoteName: remote})
	}
	return result, nil
}

func wnetRemoteName(local *uint16) (string, error) {
	length := uint32(256)
	for attempt := 0; attempt < 4; attempt++ {
		buffer := make([]uint16, length)
		status, _, _ := wnetGetConnectionProc.Call(
			uintptr(unsafe.Pointer(local)), uintptr(unsafe.Pointer(&buffer[0])), uintptr(unsafe.Pointer(&length)),
		)
		if status == 0 {
			return syscall.UTF16ToString(buffer), nil
		}
		if status != uintptr(errorMoreData) {
			return "", syscall.Errno(status)
		}
		if length <= uint32(len(buffer)) {
			length = uint32(len(buffer)) * 2
		}
	}
	return "", errors.New("WNetGetConnectionW returned an oversized remote name")
}

func isDisconnected(err error) bool {
	return errors.Is(err, errorNotConnected) || errors.Is(err, errorConnectionUnav) ||
		errors.Is(err, errorNoNetwork) || errors.Is(err, errorBadNetName)
}
