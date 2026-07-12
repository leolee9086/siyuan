//go:build windows

package vectordb

import "golang.org/x/sys/windows"

func syncDirectory(string) error {
	// Windows 不允许通过普通目录句柄调用 FlushFileBuffers；文件 Sync 会提交新文件的元数据。
	return nil
}

func durableRename(oldPath, newPath string) error {
	oldPathUTF16, err := windows.UTF16PtrFromString(oldPath)
	if err != nil {
		return err
	}
	newPathUTF16, err := windows.UTF16PtrFromString(newPath)
	if err != nil {
		return err
	}
	flags := uint32(windows.MOVEFILE_REPLACE_EXISTING | windows.MOVEFILE_WRITE_THROUGH)
	if err := windows.MoveFileEx(oldPathUTF16, newPathUTF16, flags); err != nil {
		return err
	}
	return syncParentDirectory(newPath)
}
