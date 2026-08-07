//go:build windows

package fswalk

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	windowsEpochOffset100ns    = int64(116444736000000000)
	windowsDirectoryBufferSize = 64 * 1024
)

var windowsDirectoryBufferPool = sync.Pool{New: func() any {
	return make([]byte, windowsDirectoryBufferSize)
}}

// fileIDBothDirectoryInfoHeader mirrors FILE_ID_BOTH_DIR_INFO up to FileName.
type fileIDBothDirectoryInfoHeader struct {
	NextEntryOffset uint32
	FileIndex       uint32
	CreationTime    int64
	LastAccessTime  int64
	LastWriteTime   int64
	ChangeTime      int64
	EndOfFile       int64
	AllocationSize  int64
	FileAttributes  uint32
	FileNameLength  uint32
	EaSize          uint32
	ShortNameLength byte
	_               byte
	ShortName       [12]uint16
	FileID          int64
}

func readDirectorySnapshotContext(ctx context.Context, directory string) ([]Metadata, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	entries, err := readDirectorySnapshotBatch(ctx, directory)
	if err == nil || !batchDirectoryQueryUnsupported(err) {
		return entries, err
	}
	return readDirectorySnapshotFind(ctx, directory)
}

func readDirectorySnapshotBatch(ctx context.Context, directory string) ([]Metadata, error) {
	path, err := windows.UTF16PtrFromString(longWindowsPath(directory))
	if err != nil {
		return nil, err
	}
	handle, err := windows.CreateFile(path, windows.FILE_LIST_DIRECTORY|windows.FILE_READ_ATTRIBUTES,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil,
		windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
	if err != nil {
		return nil, err
	}
	defer windows.CloseHandle(handle)

	buffer := windowsDirectoryBufferPool.Get().([]byte)
	defer windowsDirectoryBufferPool.Put(buffer)
	var entries []Metadata
	for {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		err = windows.GetFileInformationByHandleEx(handle, windows.FileIdBothDirectoryInfo,
			&buffer[0], uint32(len(buffer)))
		if errors.Is(err, windows.ERROR_NO_MORE_FILES) {
			if len(entries) == 0 {
				isReparsePoint, inspectErr := directoryHandleIsReparsePoint(handle)
				if inspectErr == nil && isReparsePoint {
					return nil, ErrDirectoryChangedToReparsePoint
				}
			}
			return entries, nil
		}
		if err != nil {
			return nil, classifyBatchDirectoryQueryError(handle, err)
		}
		entries, err = appendDirectoryInfoBatch(entries, buffer)
		if err != nil {
			return nil, err
		}
	}
}

func classifyBatchDirectoryQueryError(handle windows.Handle, queryErr error) error {
	if !batchDirectoryQueryUnsupported(queryErr) {
		return queryErr
	}
	isReparsePoint, err := directoryHandleIsReparsePoint(handle)
	if err != nil {
		return queryErr
	}
	if isReparsePoint {
		return ErrDirectoryChangedToReparsePoint
	}
	return queryErr
}

func directoryHandleIsReparsePoint(handle windows.Handle) (bool, error) {
	var information windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(handle, &information); err != nil {
		return false, err
	}
	return information.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0, nil
}

func appendDirectoryInfoBatch(entries []Metadata, buffer []byte) ([]Metadata, error) {
	const headerSize = int(unsafe.Sizeof(fileIDBothDirectoryInfoHeader{}))
	for offset := 0; ; {
		if offset < 0 || offset+headerSize > len(buffer) {
			return nil, fmt.Errorf("invalid Windows directory enumeration buffer offset %d", offset)
		}
		header := (*fileIDBothDirectoryInfoHeader)(unsafe.Pointer(&buffer[offset]))
		nameBytes := int(header.FileNameLength)
		if nameBytes%2 != 0 || offset+headerSize+nameBytes > len(buffer) {
			return nil, fmt.Errorf("invalid Windows directory entry name length %d", nameBytes)
		}
		nameData := unsafe.Slice((*uint16)(unsafe.Pointer(&buffer[offset+headerSize])), nameBytes/2)
		name := windows.UTF16ToString(nameData)
		if name != "." && name != ".." {
			entries = append(entries, snapshotEntryFromWindowsData(name, header.FileAttributes,
				header.EndOfFile, filetime100nsToUnixSeconds(header.LastWriteTime)))
		}
		if header.NextEntryOffset == 0 {
			return entries, nil
		}
		offset += int(header.NextEntryOffset)
	}
}

func readDirectorySnapshotFind(ctx context.Context, directory string) ([]Metadata, error) {
	guard, err := openDirectoryFallbackGuard(directory)
	if err != nil {
		return nil, err
	}
	defer windows.CloseHandle(guard)
	isReparsePoint, err := directoryHandleIsReparsePoint(guard)
	if err != nil {
		return nil, err
	}
	if isReparsePoint {
		return nil, ErrDirectoryChangedToReparsePoint
	}

	pattern, err := windows.UTF16PtrFromString(longWindowsPath(filepath.Join(directory, "*")))
	if err != nil {
		return nil, err
	}
	var data windows.Win32finddata
	handle, err := windows.FindFirstFile(pattern, &data)
	if errors.Is(err, windows.ERROR_FILE_NOT_FOUND) {
		return []Metadata{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer windows.FindClose(handle)

	entries := make([]Metadata, 0)
	for {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		name := windows.UTF16ToString(data.FileName[:])
		if name != "." && name != ".." {
			size := int64(data.FileSizeHigh)<<32 | int64(data.FileSizeLow)
			entries = append(entries, snapshotEntryFromWindowsData(name, data.FileAttributes,
				size, data.LastWriteTime.Nanoseconds()/int64(time.Second)))
		}
		err = windows.FindNextFile(handle, &data)
		if errors.Is(err, windows.ERROR_NO_MORE_FILES) {
			return entries, nil
		}
		if err != nil {
			return nil, err
		}
	}
}

func openDirectoryFallbackGuard(directory string) (windows.Handle, error) {
	path, err := windows.UTF16PtrFromString(longWindowsPath(directory))
	if err != nil {
		return windows.InvalidHandle, err
	}
	// 不共享删除权限，确保 FindFirstFileW 枚举期间路径不能被替换成链接。
	return windows.CreateFile(path, windows.FILE_READ_ATTRIBUTES,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE, nil, windows.OPEN_EXISTING,
		windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
}

func snapshotEntryFromWindowsData(name string, attributes uint32, size, updated int64) Metadata {
	isDir := attributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0
	isSymlink := attributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0
	return Metadata{
		Name: name, IsDir: isDir, IsSymlink: isSymlink,
		IsRegular: !isDir && !isSymlink,
		Hidden:    attributes&windows.FILE_ATTRIBUTE_HIDDEN != 0 || strings.HasPrefix(name, "."),
		Size:      size, Updated: updated,
	}
}

func filetime100nsToUnixSeconds(value int64) int64 {
	return (value - windowsEpochOffset100ns) / 10_000_000
}

func batchDirectoryQueryUnsupported(err error) bool {
	return errors.Is(err, windows.ERROR_INVALID_FUNCTION) || errors.Is(err, windows.ERROR_INVALID_PARAMETER) ||
		errors.Is(err, windows.ERROR_NOT_SUPPORTED)
}

func longWindowsPath(path string) string {
	clean := filepath.Clean(path)
	if strings.HasPrefix(clean, `\\?\`) {
		return clean
	}
	if strings.HasPrefix(clean, `\\`) {
		return `\\?\UNC\` + strings.TrimPrefix(clean, `\\`)
	}
	return `\\?\` + clean
}
