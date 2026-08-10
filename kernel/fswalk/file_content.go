package fswalk

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// LineRangeQuery 声明原始文件内容的行窗口。StartLine 为一基行号，负数表示从末尾倒数。
type LineRangeQuery struct {
	StartLine int
	MaxLines  int
}

// LineRangeResult 保留文件原始字节的 BOM、换行符和无效 UTF-8 序列。
type LineRangeResult struct {
	Path          string
	Text          string
	FileSize      int64
	Updated       int64
	StartLine     int
	EndLine       int
	TotalLines    int
	HasMore       bool
	NextStartLine int
}

// ReadLineRange 在绑定根内读取原始文件并完成与既有 file read 一致的行切片。
func (w *Walker) ReadLineRange(ctx context.Context, relative string, query LineRangeQuery) (LineRangeResult, error) {
	absolute, clean, _, err := w.resolveRegular(relative)
	if err != nil {
		return LineRangeResult{}, err
	}
	file, info, err := w.openBoundRegular(ctx, absolute)
	if err != nil {
		return LineRangeResult{}, err
	}
	defer file.Close()
	raw, err := readContextBounded(ctx, file, info.Size(), 0)
	if err != nil {
		return LineRangeResult{}, err
	}
	lines := strings.Split(string(raw), "\n")
	result := LineRangeResult{
		Path: clean, FileSize: int64(len(raw)), Updated: info.ModTime().UnixNano(), TotalLines: len(lines),
	}
	startIndex := query.StartLine
	if startIndex < 0 {
		startIndex = len(lines) + startIndex
	} else {
		startIndex--
	}
	if startIndex < 0 {
		startIndex = 0
	}
	if startIndex >= len(lines) {
		return result, ErrTextLineOutOfRange
	}
	endIndex := len(lines)
	if query.MaxLines > 0 && startIndex+query.MaxLines < endIndex {
		endIndex = startIndex + query.MaxLines
	}
	result.Text = strings.Join(lines[startIndex:endIndex], "\n")
	result.StartLine = startIndex + 1
	result.EndLine = endIndex
	result.HasMore = endIndex < len(lines)
	if result.HasMore {
		result.NextStartLine = endIndex + 1
	}
	return result, nil
}

// WriteFileContent 在绑定根内原子写入原始文件内容，并保留已有普通文件的权限位。
func (w *Walker) WriteFileContent(ctx context.Context, relative string, content []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	absolute, _, err := w.boundPath(ctx, relative, true)
	if err != nil {
		return err
	}
	if _, err = w.ensureBoundDirectory(ctx, filepath.Dir(absolute), 0755); err != nil {
		return err
	}
	mode := os.FileMode(0644)
	if existing, statErr := os.Lstat(absolute); statErr == nil {
		linkLike, linkErr := pathComponentIsLinkLike(absolute, existing)
		if linkErr != nil {
			return linkErr
		}
		if linkLike {
			return ErrPathTraversal
		}
		if !existing.Mode().IsRegular() {
			return ErrNotRegularFile
		}
		mode = existing.Mode()
	} else if !os.IsNotExist(statErr) {
		return statErr
	}
	return w.writeAtomic(ctx, absolute, content, mode)
}

// WriteFileStream atomically writes a reader into a bound regular file while
// keeping the stream and temporary file inside the Walker boundary. Existing
// regular files may be replaced; links and non-regular entries are rejected.
func (w *Walker) WriteFileStream(ctx context.Context, relative string, reader io.Reader) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if reader == nil {
		return 0, io.ErrUnexpectedEOF
	}
	absolute, _, err := w.boundPath(ctx, relative, true)
	if err != nil {
		return 0, err
	}
	if _, err = w.ensureBoundDirectory(ctx, filepath.Dir(absolute), 0755); err != nil {
		return 0, err
	}
	mode := os.FileMode(0644)
	if existing, statErr := os.Lstat(absolute); statErr == nil {
		linkLike, linkErr := pathComponentIsLinkLike(absolute, existing)
		if linkErr != nil {
			return 0, linkErr
		}
		if linkLike {
			return 0, ErrPathTraversal
		}
		if !existing.Mode().IsRegular() {
			return 0, ErrNotRegularFile
		}
		mode = existing.Mode()
	} else if !os.IsNotExist(statErr) {
		return 0, statErr
	}
	return w.writeAtomicReader(ctx, absolute, reader, mode)
}
