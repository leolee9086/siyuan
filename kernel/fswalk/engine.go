package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// Walker 固定一个已解析的授权根。所有公开操作都只接受根相对路径。
type Walker struct {
	root string
}

type boundTarget struct {
	absolute string
	relative string
	info     os.FileInfo
}

// New 校验并固定绝对目录根。
func New(root string) (*Walker, error) {
	clean, err := absoluteClean(root)
	if err != nil {
		return nil, err
	}
	resolved, err := resolvePathTarget(clean)
	if err != nil {
		return nil, ErrRootUnavailable
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.IsDir() {
		return nil, ErrRootUnavailable
	}
	return &Walker{root: filepath.Clean(resolved)}, nil
}

// ReadDirectory 返回一个根相对目录的单层快照。
func (w *Walker) ReadDirectory(ctx context.Context, relative string, sortEntries bool) ([]Metadata, error) {
	request, err := w.requestFor(relative, WalkOptions{})
	if err != nil {
		return nil, err
	}
	entries, err := readDirectorySnapshotContext(ctx, request.directory)
	if err != nil {
		return nil, err
	}
	for index := range entries {
		entries[index].Path = joinRootRelative(request.path, entries[index].Name)
		entries[index] = classifyMetadata(w.root, request.directory, entries[index])
	}
	if sortEntries {
		sortMetadata(entries)
	}
	return entries, nil
}

// Inspect 返回一个根相对入口的元数据快照，不暴露绝对路径或 FileInfo。
func (w *Walker) Inspect(ctx context.Context, relative string) (Metadata, error) {
	if err := ctx.Err(); err != nil {
		return Metadata{}, err
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return Metadata{}, err
	}
	mode := target.info.Mode()
	return Metadata{
		Name: target.info.Name(), Path: target.relative,
		IsDir: target.info.IsDir(), IsRegular: mode.IsRegular(),
		Hidden: strings.HasPrefix(target.info.Name(), "."),
		Size:   target.info.Size(), Updated: target.info.ModTime().Unix(),
	}, nil
}

// Walk 遍历一个根相对子树。回调只接收元数据，具体 I/O 始终留在模块内部。
func (w *Walker) Walk(ctx context.Context, relative string, options WalkOptions, visitor Visitor) (Result, error) {
	request, err := w.requestFor(relative, options)
	if err != nil {
		return Result{}, err
	}
	return walk(ctx, request, visitor)
}

// RelativePath 把操作系统事件提供的绝对路径转换为当前授权根内的相对入口。
// 该方法允许末端路径不存在，以支持删除事件；已有的中间组件仍会执行链接边界检查。
func (w *Walker) RelativePath(ctx context.Context, absolute string) (string, error) {
	if w == nil || w.root == "" {
		return "", ErrRootUnavailable
	}
	clean, err := absoluteClean(absolute)
	if err != nil {
		return "", err
	}
	if !sameOrWithin(w.root, clean) {
		return "", ErrPathTraversal
	}
	if err = validateBoundPathComponents(ctx, w.root, clean, true); err != nil {
		return "", err
	}
	relative, err := filepath.Rel(w.root, clean)
	if err != nil {
		return "", ErrPathTraversal
	}
	return normalizeRelative(filepath.ToSlash(relative))
}

func (w *Walker) requestFor(relative string, options WalkOptions) (walkRequest, error) {
	target, err := w.resolveTarget(relative)
	if err != nil {
		return walkRequest{}, err
	}
	if !target.info.IsDir() {
		return walkRequest{}, ErrStartUnavailable
	}
	return newWalkRequest(w.root, target.absolute, target.relative, options), nil
}

func (w *Walker) resolveRegular(relative string) (string, string, os.FileInfo, error) {
	target, err := w.resolveTarget(relative)
	if err != nil {
		return "", "", nil, err
	}
	if !target.info.Mode().IsRegular() {
		return "", "", nil, ErrNotRegularFile
	}
	return target.absolute, target.relative, target.info, nil
}

func (w *Walker) boundPath(ctx context.Context, relative string, allowMissing bool) (string, string, error) {
	if w == nil || w.root == "" {
		return "", "", ErrRootUnavailable
	}
	clean, err := normalizeRelative(relative)
	if err != nil {
		return "", "", err
	}
	absolute := filepath.Clean(filepath.Join(w.root, filepath.FromSlash(clean)))
	if !sameOrWithin(w.root, absolute) {
		return "", "", ErrPathTraversal
	}
	if err = validateBoundPathComponents(ctx, w.root, absolute, allowMissing); err != nil {
		return "", "", err
	}
	return absolute, clean, nil
}

func (w *Walker) resolveTarget(relative string) (boundTarget, error) {
	if w == nil || w.root == "" {
		return boundTarget{}, ErrRootUnavailable
	}
	clean, err := normalizeRelative(relative)
	if err != nil {
		return boundTarget{}, err
	}
	absolute := filepath.Join(w.root, filepath.FromSlash(clean))
	if !sameOrWithin(w.root, absolute) {
		return boundTarget{}, ErrPathTraversal
	}
	if err = validateBoundPathComponents(context.Background(), w.root, absolute, false); err != nil {
		if errors.Is(err, ErrPathTraversal) || errors.Is(err, ErrPathComponentNotDirectory) {
			return boundTarget{}, err
		}
		return boundTarget{}, ErrStartUnavailable
	}
	info, err := os.Lstat(absolute)
	if err != nil {
		return boundTarget{}, ErrStartUnavailable
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return boundTarget{}, ErrPathTraversal
	}
	resolved, err := resolvePathTarget(absolute)
	if err != nil {
		return boundTarget{}, ErrStartUnavailable
	}
	if !sameOrWithin(w.root, resolved) {
		return boundTarget{}, ErrPathTraversal
	}
	info, err = os.Stat(resolved)
	if err != nil {
		return boundTarget{}, ErrStartUnavailable
	}
	return boundTarget{absolute: filepath.Clean(resolved), relative: clean, info: info}, nil
}

func joinRootRelative(parent, name string) string {
	if parent == "" || parent == "." {
		return name
	}
	return filepath.ToSlash(filepath.Join(filepath.FromSlash(parent), name))
}

func classifyMetadata(root, parent string, entry Metadata) Metadata {
	if !entry.IsSymlink {
		return entry
	}
	resolved, err := resolvePathTarget(filepath.Join(parent, entry.Name))
	if err != nil || !sameOrWithin(root, resolved) {
		entry.Restricted = true
		entry.IsDir = false
		entry.IsRegular = false
		return entry
	}
	info, err := os.Stat(resolved)
	if err != nil {
		entry.Restricted = true
		entry.IsDir = false
		entry.IsRegular = false
		return entry
	}
	entry.IsDir = info.IsDir()
	entry.IsRegular = info.Mode().IsRegular()
	entry.Size = info.Size()
	entry.Updated = info.ModTime().Unix()
	return entry
}
