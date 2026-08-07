package fswalk

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
)

// CopyTreeQuery 只声明复制工作流的目录剪枝和文件选择规则。
type CopyTreeQuery struct {
	PruneDirectory func(Metadata) bool
	SelectFile     func(Metadata) bool
}

// CopyTreeResult 汇总一次复制实际处理的条目。路径错误始终使用源根相对路径。
type CopyTreeResult struct {
	Traversal             Result
	CopiedFileCount       int
	CopiedDirectoryCount  int
	CreatedDirectoryCount int
	SkippedFileCount      int
	SkippedDirectoryCount int
	CopiedBytes           int64
}

var copyBufferPool = sync.Pool{New: func() any { return make([]byte, 256*1024) }}

// CopyTree 把源文件或目录复制到目标 Walker 的根相对位置。
//
// 目录采用合并语义，普通文件采用原子覆盖语义。链接和特殊文件不会被跟随；
// 调用方可通过声明式筛选在复制前排除它们。
func (w *Walker) CopyTree(ctx context.Context, sourceRelative string, destination *Walker,
	destinationRelative string, query CopyTreeQuery) (CopyTreeResult, error) {
	result := CopyTreeResult{}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if destination == nil || destination.root == "" {
		return result, ErrRootUnavailable
	}
	source, err := w.resolveTarget(sourceRelative)
	if err != nil {
		return result, err
	}
	destinationAbsolute, destinationClean, err := destination.resolveCopyDestination(destinationRelative)
	if err != nil {
		return result, err
	}
	if copyPathsOverlap(source.absolute, source.info.IsDir(), destinationAbsolute) {
		return result, ErrCopyPathOverlap
	}

	if source.info.Mode().IsRegular() {
		entry := metadataFromFileInfo(source.relative, source.info, 0)
		result.Traversal = Result{Path: source.relative, EntryCount: 1, FileCount: 1}
		if query.SelectFile != nil && !query.SelectFile(entry) {
			result.SkippedFileCount = 1
			return result, nil
		}
		copied, created, copyErr := w.copyRegularTo(ctx, source.absolute, destination, destinationAbsolute)
		result.CreatedDirectoryCount += created
		if copyErr != nil {
			return result, PathError{Path: source.relative, Err: copyErr}
		}
		result.CopiedFileCount = 1
		result.CopiedBytes = copied
		return result, nil
	}
	if !source.info.IsDir() {
		return result, ErrCopyUnsupportedFile
	}

	created, err := destination.ensureBoundDirectory(ctx, destinationAbsolute, source.info.Mode())
	result.CreatedDirectoryCount += created
	if err != nil {
		return result, err
	}
	result.CopiedDirectoryCount = 1

	request := newWalkRequest(w.root, source.absolute, source.relative, WalkOptions{SortEntries: true})
	request.stopOnError = true
	visit := func(entry Metadata, sourceAbsolute string) error {
		if entry.IsDir {
			if query.PruneDirectory != nil && query.PruneDirectory(entry) {
				result.SkippedDirectoryCount++
				return fs.SkipDir
			}
			if entry.IsSymlink || entry.Restricted {
				return PathError{Path: entry.Path, Err: ErrCopySymlink}
			}
			targetAbsolute, targetRelative, mapErr := mapCopyDestination(
				source.absolute, sourceAbsolute, destination.root, destinationClean)
			if mapErr != nil {
				return PathError{Path: entry.Path, Err: mapErr}
			}
			mode, modeErr := w.boundDirectoryMode(sourceAbsolute)
			if modeErr != nil {
				return PathError{Path: entry.Path, Err: modeErr}
			}
			createdCount, createErr := destination.ensureBoundDirectory(ctx, targetAbsolute, mode)
			result.CreatedDirectoryCount += createdCount
			if createErr != nil {
				return PathError{Path: targetRelative, Err: createErr}
			}
			result.CopiedDirectoryCount++
			return nil
		}
		if query.SelectFile != nil && !query.SelectFile(entry) {
			result.SkippedFileCount++
			return nil
		}
		if entry.IsSymlink || entry.Restricted {
			return PathError{Path: entry.Path, Err: ErrCopySymlink}
		}
		if !entry.IsRegular {
			return PathError{Path: entry.Path, Err: ErrCopyUnsupportedFile}
		}
		targetAbsolute, _, mapErr := mapCopyDestination(
			source.absolute, sourceAbsolute, destination.root, destinationClean)
		if mapErr != nil {
			return PathError{Path: entry.Path, Err: mapErr}
		}
		copied, createdCount, copyErr := w.copyRegularTo(ctx, sourceAbsolute, destination, targetAbsolute)
		result.CreatedDirectoryCount += createdCount
		if copyErr != nil {
			return PathError{Path: entry.Path, Err: copyErr}
		}
		result.CopiedFileCount++
		result.CopiedBytes += copied
		return nil
	}
	result.Traversal, err = walkWithPath(ctx, request, visit)
	return result, err
}

func (w *Walker) resolveCopyDestination(relative string) (absolute, clean string, err error) {
	if w == nil || w.root == "" {
		return "", "", ErrRootUnavailable
	}
	clean, err = normalizeRelative(relative)
	if err != nil {
		return "", "", err
	}
	absolute = filepath.Clean(filepath.Join(w.root, filepath.FromSlash(clean)))
	if !sameOrWithin(w.root, absolute) {
		return "", "", ErrPathTraversal
	}
	if err = validateBoundPathComponents(context.Background(), w.root, absolute, true); err != nil {
		if errors.Is(err, ErrPathComponentNotDirectory) {
			return "", "", ErrCopyDestinationType
		}
		return "", "", err
	}
	return absolute, clean, nil
}

func copyPathsOverlap(source string, sourceIsDirectory bool, destination string) bool {
	if sourceIsDirectory {
		return sameOrWithin(source, destination) || sameOrWithin(destination, source)
	}
	return sameOrWithin(source, destination) && sameOrWithin(destination, source)
}

func mapCopyDestination(sourceRoot, sourcePath, destinationRoot, destinationRelative string) (
	absolute, relative string, err error) {
	child, err := filepath.Rel(sourceRoot, sourcePath)
	if err != nil || filepath.IsAbs(child) || child == ".." ||
		(len(child) > 3 && child[:3] == ".."+string(filepath.Separator)) {
		return "", "", ErrPathTraversal
	}
	relative = joinRootRelative(destinationRelative, filepath.ToSlash(child))
	absolute = filepath.Clean(filepath.Join(destinationRoot, filepath.FromSlash(relative)))
	if !sameOrWithin(destinationRoot, absolute) {
		return "", "", ErrPathTraversal
	}
	return absolute, relative, nil
}

func (w *Walker) boundDirectoryMode(absolute string) (os.FileMode, error) {
	if w == nil || w.root == "" || !sameOrWithin(w.root, absolute) {
		return 0, ErrPathTraversal
	}
	info, err := os.Lstat(absolute)
	if err != nil {
		return 0, err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return 0, ErrCopySymlink
	}
	if !info.IsDir() {
		return 0, ErrCopyUnsupportedFile
	}
	resolved, err := resolvePathTarget(absolute)
	if err != nil || !sameOrWithin(w.root, resolved) {
		return 0, ErrPathTraversal
	}
	return info.Mode(), nil
}

func (w *Walker) ensureBoundDirectory(ctx context.Context, directory string, mode os.FileMode) (int, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	directory = filepath.Clean(directory)
	if w == nil || w.root == "" || !sameOrWithin(w.root, directory) {
		return 0, ErrPathTraversal
	}
	relative, err := filepath.Rel(w.root, directory)
	if err != nil || filepath.IsAbs(relative) || relative == ".." {
		return 0, ErrPathTraversal
	}
	permission := mode.Perm()
	if permission == 0 {
		permission = 0755
	}
	current := w.root
	created := 0
	components := []string{}
	if relative != "." {
		components = splitRelativePath(relative)
	}
	for _, component := range components {
		if err = ctx.Err(); err != nil {
			return created, err
		}
		current = filepath.Join(current, component)
		info, statErr := os.Lstat(current)
		if os.IsNotExist(statErr) {
			createdHere := false
			if mkdirErr := os.Mkdir(current, permission); mkdirErr == nil {
				createdHere = true
			} else if !os.IsExist(mkdirErr) {
				return created, mkdirErr
			}
			info, statErr = os.Lstat(current)
			if statErr == nil && createdHere {
				created++
			}
		}
		if statErr != nil {
			return created, statErr
		}
		linkLike, linkErr := pathComponentIsLinkLike(current, info)
		if linkErr != nil {
			return created, linkErr
		}
		if linkLike {
			return created, ErrPathTraversal
		}
		if !info.IsDir() {
			return created, ErrCopyDestinationType
		}
		resolved, resolveErr := resolvePathTarget(current)
		if resolveErr != nil || !sameOrWithin(w.root, resolved) {
			return created, ErrPathTraversal
		}
	}
	return created, nil
}

func (source *Walker) copyRegularTo(ctx context.Context, sourceAbsolute string, destination *Walker,
	destinationAbsolute string) (copied int64, createdDirectories int, err error) {
	file, info, err := source.openBoundRegular(ctx, sourceAbsolute)
	if err != nil {
		return 0, 0, err
	}
	defer file.Close()

	createdDirectories, err = destination.ensureBoundDirectory(ctx, filepath.Dir(destinationAbsolute), 0755)
	if err != nil {
		return 0, createdDirectories, err
	}
	if existing, statErr := os.Lstat(destinationAbsolute); statErr == nil {
		if existing.Mode()&os.ModeSymlink != 0 {
			return 0, createdDirectories, ErrPathTraversal
		}
		if !existing.Mode().IsRegular() {
			return 0, createdDirectories, ErrCopyDestinationType
		}
	} else if !os.IsNotExist(statErr) {
		return 0, createdDirectories, statErr
	}

	temporary, err := os.CreateTemp(filepath.Dir(destinationAbsolute), ".sforge-copy-*")
	if err != nil {
		return 0, createdDirectories, err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err = verifyOpenedFileWithinRoot(destination.root, temporary); err == nil {
		err = temporary.Chmod(info.Mode().Perm())
	}
	if err == nil {
		buffer := copyBufferPool.Get().([]byte)
		copied, err = copyContext(ctx, temporary, file, buffer)
		copyBufferPool.Put(buffer)
	}
	if err == nil {
		err = temporary.Sync()
	}
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return copied, createdDirectories, err
	}
	if err = ctx.Err(); err != nil {
		return copied, createdDirectories, err
	}
	if err = replaceFile(temporaryPath, destinationAbsolute); err != nil {
		return copied, createdDirectories, err
	}
	if err = syncParentDirectory(filepath.Dir(destinationAbsolute)); err != nil {
		return copied, createdDirectories, err
	}
	return copied, createdDirectories, nil
}

func copyContext(ctx context.Context, destination io.Writer, source io.Reader, buffer []byte) (int64, error) {
	var copied int64
	for {
		if err := ctx.Err(); err != nil {
			return copied, err
		}
		read, readErr := source.Read(buffer)
		if read > 0 {
			if writeErr := writeAllContext(ctx, destination, buffer[:read]); writeErr != nil {
				return copied, writeErr
			}
			copied += int64(read)
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				return copied, nil
			}
			return copied, readErr
		}
	}
}
