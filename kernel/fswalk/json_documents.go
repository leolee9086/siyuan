package fswalk

import (
	"context"
	"errors"
	"io/fs"
)

// JSONDocumentQuery 描述 JSON 文档树的目录剪枝、文件选择和读取上限。
type JSONDocumentQuery struct {
	MaxFileBytes   int64
	PruneDirectory func(Metadata) bool
	SelectFile     func(Metadata) bool
}

// JSONDocument 是模块读取后的不可变文档快照，不暴露绝对路径或文件句柄。
type JSONDocument struct {
	Path    string
	Bytes   []byte
	Updated int64
}

// JSONDocumentResult 汇总文档、读取错误和遍历结果。
type JSONDocumentResult struct {
	Traversal         Result
	Documents         []JSONDocument
	SelectedFileCount int
	ReadFileCount     int
	SkippedLargeCount int
	FileErrorCount    int
	FileErrors        []PathError
	ErrorsTruncated   bool
}

// JSONDocumentVisitor 消费模块读取完成的不可变 JSON 文档快照。
type JSONDocumentVisitor func(JSONDocument) error

// ReadJSONDocuments 读取一个根相对文件或目录下的 JSON 候选。
// JSON 解码仍由领域层执行；本入口只负责安全枚举和受限快照读取。
func (w *Walker) ReadJSONDocuments(ctx context.Context, relative string,
	query JSONDocumentQuery) (JSONDocumentResult, error) {
	documents := []JSONDocument{}
	result, err := w.VisitJSONDocuments(ctx, relative, query, func(document JSONDocument) error {
		documents = append(documents, document)
		return nil
	})
	result.Documents = documents
	return result, err
}

// VisitJSONDocuments 在模块内部完成枚举和读取，并把快照逐个交给声明式回调。
// 回调不会获得绝对路径、文件句柄或 Reader。
func (w *Walker) VisitJSONDocuments(ctx context.Context, relative string, query JSONDocumentQuery,
	visitor JSONDocumentVisitor) (JSONDocumentResult, error) {
	result := JSONDocumentResult{FileErrors: []PathError{}}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return result, err
	}
	maxErrors := DefaultRetainedErrors
	visit := func(entry Metadata, absolute string) error {
		if entry.IsDir {
			if query.PruneDirectory != nil && query.PruneDirectory(entry) {
				return fs.SkipDir
			}
			return nil
		}
		if entry.IsSymlink || entry.Restricted || !entry.IsRegular {
			return nil
		}
		if query.SelectFile != nil && !query.SelectFile(entry) {
			return nil
		}
		result.SelectedFileCount++
		file, _, openErr := w.openBoundRegular(ctx, absolute)
		if openErr != nil {
			return addJSONDocumentError(&result, entry.Path, openErr, maxErrors)
		}
		data, readErr := readContextBounded(ctx, file, entry.Size, query.MaxFileBytes)
		file.Close()
		if readErr != nil {
			if errors.Is(readErr, context.Canceled) {
				return readErr
			}
			return addJSONDocumentError(&result, entry.Path, readErr, maxErrors)
		}
		result.ReadFileCount++
		document := JSONDocument{
			Path: entry.Path, Bytes: data, Updated: entry.Updated,
		}
		if visitor != nil {
			return visitor(document)
		}
		return nil
	}
	if target.info.Mode().IsRegular() {
		entry := metadataFromFileInfo(target.relative, target.info, 0)
		result.Traversal = Result{Path: target.relative, EntryCount: 1, FileCount: 1}
		err = visit(entry, target.absolute)
	} else {
		request := newWalkRequest(w.root, target.absolute, target.relative, WalkOptions{SortEntries: true})
		result.Traversal, err = walkWithPath(ctx, request, visit)
	}
	if err != nil {
		return result, err
	}
	return result, nil
}

func addJSONDocumentError(result *JSONDocumentResult, path string, err error, maxErrors int) error {
	if errors.Is(err, ErrTextFileTooLarge) {
		result.SkippedLargeCount++
		return nil
	}
	result.FileErrorCount++
	if len(result.FileErrors) < maxErrors {
		result.FileErrors = append(result.FileErrors, PathError{Path: path, Err: err})
	} else {
		result.ErrorsTruncated = true
	}
	return nil
}
