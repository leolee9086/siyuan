package fswalk

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
)

func (w *Walker) writeAtomic(ctx context.Context, target string, content []byte, mode os.FileMode) error {
	_, err := w.writeAtomicReader(ctx, target, bytes.NewReader(content), mode)
	return err
}

func (w *Walker) writeAtomicReader(ctx context.Context, target string, reader io.Reader, mode os.FileMode) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if reader == nil {
		return 0, io.ErrUnexpectedEOF
	}
	target = filepath.Clean(target)
	if w == nil || w.root == "" || !sameOrWithin(w.root, target) {
		return 0, ErrPathTraversal
	}
	if err := validateBoundPathComponents(ctx, w.root, filepath.Dir(target), false); err != nil {
		return 0, err
	}
	parent, err := resolvePathTarget(filepath.Dir(target))
	if err != nil || !sameOrWithin(w.root, parent) {
		return 0, ErrPathTraversal
	}
	if existing, statErr := os.Lstat(target); statErr == nil {
		if existing.Mode()&os.ModeSymlink != 0 {
			return 0, ErrPathTraversal
		}
		if !existing.Mode().IsRegular() {
			return 0, ErrNotRegularFile
		}
	} else if statErr != nil && !os.IsNotExist(statErr) {
		return 0, statErr
	}

	temporary, err := os.CreateTemp(parent, ".sforge-write-*")
	if err != nil {
		return 0, err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	var written int64
	if err = verifyOpenedFileWithinRoot(w.root, temporary); err == nil {
		err = temporary.Chmod(mode.Perm())
	}
	if err == nil {
		written, err = writeReaderContext(ctx, temporary, reader)
	}
	if err == nil {
		if err = ctx.Err(); err == nil {
			err = temporary.Sync()
		}
	}
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return written, err
	}
	if err = ctx.Err(); err != nil {
		return written, err
	}
	if err = replaceFile(temporaryPath, target); err != nil {
		return written, err
	}
	return written, syncParentDirectory(parent)
}

func writeAllContext(ctx context.Context, writer io.Writer, content []byte) error {
	for len(content) > 0 {
		if err := ctx.Err(); err != nil {
			return err
		}
		count, err := writer.Write(content)
		if err != nil {
			return err
		}
		if count == 0 {
			return io.ErrShortWrite
		}
		content = content[count:]
	}
	return nil
}

func writeReaderContext(ctx context.Context, writer io.Writer, reader io.Reader) (int64, error) {
	buffer := make([]byte, 128*1024)
	var written int64
	zeroReads := 0
	for {
		if err := ctx.Err(); err != nil {
			return written, err
		}
		read, readErr := reader.Read(buffer)
		if read > 0 {
			zeroReads = 0
			if err := writeAllContext(ctx, writer, buffer[:read]); err != nil {
				return written, err
			}
			written += int64(read)
		}
		if readErr != nil {
			if readErr == io.EOF {
				return written, nil
			}
			return written, readErr
		}
		if read == 0 {
			zeroReads++
			if zeroReads >= 100 {
				return written, io.ErrNoProgress
			}
		}
	}
}
