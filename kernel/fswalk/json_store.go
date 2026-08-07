package fswalk

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const defaultJSONStoreBytes = int64(4 * 1024 * 1024)

// JSONStore 是绑定到 Walker 根内一个命名空间的 JSON 文档存储。
// key 始终是命名空间内的逻辑相对路径，模块负责 .json 后缀、目录创建、读取上限和原子替换。
type JSONStore struct {
	walker       *Walker
	base         string
	maxFileBytes int64
}

// JSONStoreDocument 是 JSONStore 读取后的文档快照。
type JSONStoreDocument struct {
	Key     string
	Bytes   []byte
	Updated int64
}

// JSONStoreQuery 声明 JSONStore 遍历阶段的业务剪枝和选择规则。
type JSONStoreQuery struct {
	PruneDirectory func(Metadata) bool
	SelectDocument func(Metadata) bool
}

// JSONStoreResult 汇总一次 JSONStore 遍历，不保留全部文档内容。
type JSONStoreResult struct {
	Traversal         Result
	SelectedFileCount int
	ReadFileCount     int
	SkippedLargeCount int
	FileErrorCount    int
	FileErrors        []PathError
	ErrorsTruncated   bool
}

// BindJSONStore 在当前授权根内绑定一个 JSON 命名空间。
// 命名空间可以尚不存在，首次保存时由模块安全创建。
func (w *Walker) BindJSONStore(relative string, maxFileBytes int64) (*JSONStore, error) {
	if w == nil || w.root == "" {
		return nil, ErrRootUnavailable
	}
	base, err := normalizeRelative(relative)
	if err != nil {
		return nil, err
	}
	if _, _, err = w.boundPath(context.Background(), base, true); err != nil {
		return nil, err
	}
	if base != "" {
		absolute, _, pathErr := w.boundPath(context.Background(), base, true)
		if pathErr != nil {
			return nil, pathErr
		}
		if info, statErr := os.Lstat(absolute); statErr == nil && !info.IsDir() {
			return nil, ErrPathComponentNotDirectory
		} else if statErr != nil && !os.IsNotExist(statErr) {
			return nil, statErr
		}
	}
	if maxFileBytes <= 0 {
		maxFileBytes = defaultJSONStoreBytes
	}
	return &JSONStore{walker: w, base: base, maxFileBytes: maxFileBytes}, nil
}

// Load 解码一个逻辑 JSON 文档。目标对象由领域层提供，文件句柄和具体读取留在模块内。
func (s *JSONStore) Load(ctx context.Context, key string, target any) error {
	absolute, _, err := s.documentPath(ctx, key)
	if err != nil {
		return err
	}
	info, err := os.Lstat(absolute)
	if err != nil {
		if os.IsNotExist(err) {
			return fs.ErrNotExist
		}
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
		return ErrNotRegularFile
	}
	file, currentInfo, err := s.walker.openBoundRegular(ctx, absolute)
	if err != nil {
		return err
	}
	data, readErr := readContextBounded(ctx, file, currentInfo.Size(), s.maxFileBytes)
	closeErr := file.Close()
	if readErr != nil {
		return readErr
	}
	if closeErr != nil {
		return closeErr
	}
	return json.Unmarshal(data, target)
}

// Save 编码并原子保存一个逻辑 JSON 文档。
func (s *JSONStore) Save(ctx context.Context, key string, value any) error {
	absolute, _, err := s.documentPath(ctx, key)
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	if int64(len(data)) > s.maxFileBytes {
		return ErrTextFileTooLarge
	}
	if _, err = s.walker.ensureBoundDirectory(ctx, filepath.Dir(absolute), 0755); err != nil {
		return err
	}
	return s.walker.writeAtomic(ctx, absolute, data, 0644)
}

// Remove 删除一个逻辑 JSON 文档。不存在时返回 false，不会跟随链接。
func (s *JSONStore) Remove(ctx context.Context, key string) (bool, error) {
	absolute, _, err := s.documentPath(ctx, key)
	if err != nil {
		return false, err
	}
	info, err := os.Lstat(absolute)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return false, ErrPathTraversal
	}
	if !info.Mode().IsRegular() {
		return false, ErrNotRegularFile
	}
	if err = validateBoundPathComponents(ctx, s.walker.root, absolute, false); err != nil {
		return false, err
	}
	if err = os.Remove(absolute); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Visit 遍历命名空间内的 JSON 文档，模块负责读取，领域层只消费快照回调。
func (s *JSONStore) Visit(ctx context.Context, relative string, query JSONStoreQuery,
	visitor func(JSONStoreDocument) error) (JSONStoreResult, error) {
	result := JSONStoreResult{FileErrors: []PathError{}}
	clean, err := normalizeRelative(relative)
	if err != nil {
		return result, err
	}
	start := joinRootRelative(s.base, clean)
	if _, _, err = s.walker.boundPath(ctx, start, true); err != nil {
		return result, err
	}
	absolute, _, pathErr := s.walker.boundPath(ctx, start, true)
	if pathErr != nil {
		return result, pathErr
	}
	if _, statErr := os.Lstat(absolute); os.IsNotExist(statErr) {
		result.Traversal = Result{Path: clean, Errors: []PathError{}}
		return result, nil
	} else if statErr != nil {
		return result, statErr
	}
	underlying, err := s.walker.VisitJSONDocuments(ctx, start, JSONDocumentQuery{
		MaxFileBytes: s.maxFileBytes,
		PruneDirectory: func(entry Metadata) bool {
			mapped := s.mapMetadata(entry)
			return query.PruneDirectory != nil && query.PruneDirectory(mapped)
		},
		SelectFile: func(entry Metadata) bool {
			if path.Ext(entry.Name) != ".json" {
				return false
			}
			mapped := s.mapMetadata(entry)
			return query.SelectDocument == nil || query.SelectDocument(mapped)
		},
	}, func(document JSONDocument) error {
		mapped, mapErr := s.mapDocument(document)
		if mapErr != nil {
			return mapErr
		}
		if visitor == nil {
			return nil
		}
		return visitor(mapped)
	})
	result.Traversal = s.mapTraversal(underlying.Traversal, clean)
	result.SelectedFileCount = underlying.SelectedFileCount
	result.ReadFileCount = underlying.ReadFileCount
	result.SkippedLargeCount = underlying.SkippedLargeCount
	result.FileErrorCount = underlying.FileErrorCount
	result.ErrorsTruncated = underlying.ErrorsTruncated
	for _, fileErr := range underlying.FileErrors {
		mapped, mapErr := s.mapStoredPath(fileErr.Path)
		if mapErr != nil {
			result.FileErrors = append(result.FileErrors, fileErr)
			continue
		}
		fileErr.Path = mapped
		result.FileErrors = append(result.FileErrors, fileErr)
	}
	return result, err
}

func (s *JSONStore) documentPath(ctx context.Context, key string) (string, string, error) {
	if s == nil || s.walker == nil {
		return "", "", ErrRootUnavailable
	}
	clean, err := normalizeRelative(key)
	if err != nil {
		return "", "", err
	}
	if clean == "" {
		return "", "", ErrInvalidJSONKey
	}
	physical := joinRootRelative(s.base, clean+".json")
	absolute, _, err := s.walker.boundPath(ctx, physical, true)
	return absolute, clean, err
}

func (s *JSONStore) mapMetadata(entry Metadata) Metadata {
	if relative, err := s.mapStoredPath(entry.Path); err == nil {
		entry.Path = relative
	}
	return entry
}

func (s *JSONStore) mapDocument(document JSONDocument) (JSONStoreDocument, error) {
	key, err := s.mapStoredPath(document.Path)
	if err != nil {
		return JSONStoreDocument{}, err
	}
	key = strings.TrimSuffix(key, ".json")
	return JSONStoreDocument{Key: key, Bytes: document.Bytes, Updated: document.Updated}, nil
}

func (s *JSONStore) mapStoredPath(relative string) (string, error) {
	clean, err := normalizeRelative(relative)
	if err != nil {
		return "", err
	}
	if s.base == "" {
		return clean, nil
	}
	prefix := s.base + "/"
	if !strings.HasPrefix(clean, prefix) {
		return "", ErrPathTraversal
	}
	return strings.TrimPrefix(clean, prefix), nil
}

func (s *JSONStore) mapTraversal(traversal Result, relative string) Result {
	traversal.Path = relative
	for index := range traversal.Errors {
		if mapped, err := s.mapStoredPath(traversal.Errors[index].Path); err == nil {
			traversal.Errors[index].Path = mapped
		}
	}
	return traversal
}
