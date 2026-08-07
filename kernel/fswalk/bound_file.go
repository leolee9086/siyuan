package fswalk

import (
	"context"
	"io"
	"os"
	"path/filepath"
)

func (w *Walker) openBoundRegular(ctx context.Context, absolute string) (*os.File, os.FileInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, nil, err
	}
	absolute = filepath.Clean(absolute)
	if w == nil || w.root == "" || !sameOrWithin(w.root, absolute) {
		return nil, nil, ErrPathTraversal
	}
	if err := validateBoundPathComponents(ctx, w.root, absolute, false); err != nil {
		return nil, nil, err
	}
	before, err := os.Lstat(absolute)
	if err != nil {
		return nil, nil, err
	}
	if before.Mode()&os.ModeSymlink != 0 || !before.Mode().IsRegular() {
		return nil, nil, ErrNotRegularFile
	}
	file, err := os.Open(absolute)
	if err != nil {
		return nil, nil, err
	}
	if err = verifyOpenedFileWithinRoot(w.root, file); err != nil {
		file.Close()
		return nil, nil, err
	}
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		file.Close()
		if err != nil {
			return nil, nil, err
		}
		return nil, nil, ErrNotRegularFile
	}
	return file, info, nil
}

func readContextBounded(ctx context.Context, reader io.Reader, expected, maxBytes int64) ([]byte, error) {
	capacity := expected
	if capacity < 0 {
		capacity = 0
	}
	if maxBytes > 0 && capacity > maxBytes+1 {
		capacity = maxBytes + 1
	}
	const maximumInitialCapacity = int64(4 * 1024 * 1024)
	if capacity > maximumInitialCapacity {
		capacity = maximumInitialCapacity
	}
	data := make([]byte, 0, int(capacity))
	buffer := make([]byte, 64*1024)
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		count, err := reader.Read(buffer)
		if count > 0 {
			data = append(data, buffer[:count]...)
			if maxBytes > 0 && int64(len(data)) > maxBytes {
				return nil, ErrTextFileTooLarge
			}
		}
		if err != nil {
			if err == io.EOF {
				return data, nil
			}
			return nil, err
		}
	}
}
