//go:build windows

package windowssmbmount

import (
	"context"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type osFileSystem struct {
	root string
}

func newOSFileSystem(root string) FileSystem {
	return &osFileSystem{root: filepath.Clean(root)}
}

func (f *osFileSystem) ReadDir(ctx context.Context, relative string) ([]FileInfo, error) {
	path, err := f.path(ctx, relative)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	result := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		result = append(result, FileInfo{Name: entry.Name(), Size: info.Size(), Mode: info.Mode(), ModTime: info.ModTime(), IsDir: info.IsDir()})
	}
	return result, nil
}

func (f *osFileSystem) Stat(ctx context.Context, relative string) (FileInfo, error) {
	path, err := f.path(ctx, relative)
	if err != nil {
		return FileInfo{}, err
	}
	info, err := os.Stat(path)
	if err != nil {
		return FileInfo{}, err
	}
	return FileInfo{Name: info.Name(), Size: info.Size(), Mode: info.Mode(), ModTime: info.ModTime(), IsDir: info.IsDir()}, nil
}

func (f *osFileSystem) Open(ctx context.Context, relative string) (io.ReadCloser, error) {
	path, err := f.path(ctx, relative)
	if err != nil {
		return nil, err
	}
	return os.Open(path)
}

func (f *osFileSystem) Create(ctx context.Context, relative string, content io.Reader, size int64, mode fs.FileMode) error {
	path, err := f.path(ctx, relative)
	if err != nil {
		return err
	}
	if content == nil {
		return os.Mkdir(path, mode.Perm())
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode.Perm())
	if err != nil {
		return err
	}
	count, copyErr := io.Copy(file, content)
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	if size >= 0 && count != size {
		return fs.ErrInvalid
	}
	return nil
}

func (f *osFileSystem) Rename(ctx context.Context, source, destination string) error {
	sourcePath, err := f.path(ctx, source)
	if err != nil {
		return err
	}
	destinationPath, err := f.path(ctx, destination)
	if err != nil {
		return err
	}
	return os.Rename(sourcePath, destinationPath)
}

func (f *osFileSystem) Remove(ctx context.Context, relative string, recursive bool) error {
	path, err := f.path(ctx, relative)
	if err != nil {
		return err
	}
	if filepath.Clean(path) == filepath.Clean(f.root) {
		return fs.ErrInvalid
	}
	if recursive {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}

func (f *osFileSystem) Copy(ctx context.Context, source, destination string, overwrite bool) error {
	sourcePath, err := f.path(ctx, source)
	if err != nil {
		return err
	}
	destinationPath, err := f.path(ctx, destination)
	if err != nil {
		return err
	}
	if !overwrite {
		if _, statErr := os.Stat(destinationPath); statErr == nil {
			return fs.ErrExist
		} else if !os.IsNotExist(statErr) {
			return statErr
		}
	}
	info, err := os.Stat(sourcePath)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return copyDirectory(ctx, sourcePath, destinationPath)
	}
	return copyFile(sourcePath, destinationPath, info.Mode())
}

func (f *osFileSystem) path(ctx context.Context, relative string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	normalized, err := normalizeRelativePath(relative)
	if err != nil {
		return "", err
	}
	if normalized == "" {
		return f.root, nil
	}
	path := filepath.Join(f.root, filepath.FromSlash(normalized))
	rel, err := filepath.Rel(f.root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", externalInvalidPath()
	}
	return path, nil
}

func copyFile(source, destination string, mode fs.FileMode) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode.Perm())
	if err != nil {
		return err
	}
	if _, err = io.Copy(output, input); err != nil {
		_ = output.Close()
		return err
	}
	return output.Close()
}

func copyDirectory(ctx context.Context, source, destination string) error {
	if err := os.MkdirAll(destination, 0755); err != nil {
		return err
	}
	entries, err := os.ReadDir(source)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return err
		}
		sourceChild := filepath.Join(source, entry.Name())
		destinationChild := filepath.Join(destination, entry.Name())
		if entry.IsDir() {
			if err := copyDirectory(ctx, sourceChild, destinationChild); err != nil {
				return err
			}
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if err := copyFile(sourceChild, destinationChild, info.Mode()); err != nil {
			return err
		}
	}
	return nil
}

func externalInvalidPath() error {
	return externalprovider.ErrInvalidRequest
}
