package filebrowser

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

const maxPropertyItems = 100

// Properties 验证并描述一个文件或目录。
func (s *Service) Properties(request FileRequest) (ItemProperties, error) {
	return s.PropertiesContext(context.Background(), request)
}

// PropertiesContext 验证并描述一个文件或目录，并允许取消图片头探测。
func (s *Service) PropertiesContext(ctx context.Context, request FileRequest) (ItemProperties, error) {
	if err := ctx.Err(); err != nil {
		return ItemProperties{}, err
	}
	root, err := s.rootByID(request.RootID)
	if err != nil {
		return ItemProperties{}, err
	}
	return s.propertiesForRoot(ctx, root, request.Path)
}

func (s *Service) propertiesForRoot(ctx context.Context, root Root, relative string) (ItemProperties, error) {
	absolute, relative, info, err := s.resolveExistingPath(root, relative)
	if err != nil {
		return ItemProperties{}, err
	}
	if err = ctx.Err(); err != nil {
		return ItemProperties{}, err
	}
	if !info.IsDir() && !info.Mode().IsRegular() {
		return ItemProperties{}, ErrNotFile
	}
	name := info.Name()
	if relative == "" {
		name = root.Label
	}
	extension := ""
	if !info.IsDir() {
		extension = strings.ToLower(filepath.Ext(name))
	}
	entry := Entry{
		Name: name, Path: relative, IsDir: info.IsDir(), IsSymlink: originalPathIsSymlink(root, relative),
		Hidden: strings.HasPrefix(name, "."), Size: info.Size(), Updated: info.ModTime().Unix(), Extension: extension,
	}
	properties := ItemProperties{
		Root: root, Entry: entry, PreviewKind: PreviewKindDirectory,
		Revision: itemRevision(info), Created: fileCreationTime(info), ReadOnly: !root.Capabilities.Write,
	}
	if info.IsDir() {
		return properties, nil
	}
	properties.MediaType = detectMediaType(absolute)
	properties.PreviewKind = classifyPreview(properties.MediaType, extension)
	properties.ContentURL = contentURL(root.ID, relative)
	if properties.PreviewKind == PreviewKindImage {
		properties.Width, properties.Height = probeImageDimensions(ctx, root, relative)
	}
	return properties, nil
}

func originalPathIsSymlink(root Root, relative string) bool {
	if relative == "" {
		return false
	}
	info, err := os.Lstat(filepath.Join(root.Path, filepath.FromSlash(relative)))
	return err == nil && info.Mode()&os.ModeSymlink != 0
}

func itemRevision(info os.FileInfo) string {
	return fmt.Sprintf("%x-%x-%t", info.ModTime().UnixNano(), info.Size(), info.IsDir())
}

func probeImageDimensions(ctx context.Context, root Root, relative string) (int, int) {
	walker, err := fswalk.New(root.Path)
	if err != nil {
		return 0, 0
	}
	probe, err := walker.ProbeImage(ctx, relative)
	if err != nil {
		return 0, 0
	}
	return probe.Width, probe.Height
}

// BatchProperties 以一次根快照并发读取属性，结果顺序与请求一致。
func (s *Service) BatchProperties(ctx context.Context, request BatchPropertiesRequest) (BatchPropertiesResult, error) {
	result := BatchPropertiesResult{Items: make([]PropertyItemResult, len(request.Items))}
	if len(request.Items) == 0 {
		return result, ErrPropertiesEmpty
	}
	if len(request.Items) > maxPropertyItems {
		return result, ErrPropertiesTooLarge
	}
	roots, err := s.ListRoots()
	if err != nil {
		return result, err
	}
	rootByID := make(map[string]Root, len(roots))
	for _, root := range roots {
		rootByID[root.ID] = root
	}
	jobs := make(chan int)
	var wait sync.WaitGroup
	for range fswalk.RecommendedWorkers(len(request.Items)) {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for index := range jobs {
				item := request.Items[index]
				itemResult := PropertyItemResult{Request: item}
				root, exists := rootByID[item.RootID]
				var properties ItemProperties
				var itemErr error
				if !exists {
					itemErr = ErrRootNotFound
				} else {
					properties, itemErr = s.propertiesForRoot(ctx, root, item.Path)
				}
				if itemErr != nil {
					itemResult.Error = propertyFailure(itemErr)
				} else {
					itemResult.Properties = &properties
				}
				result.Items[index] = itemResult
			}
		}()
	}
	for index := range request.Items {
		jobs <- index
	}
	close(jobs)
	wait.Wait()
	for _, item := range result.Items {
		if item.Error == nil {
			result.SuccessCount++
		} else {
			result.FailureCount++
		}
	}
	return result, nil
}

func propertyFailure(err error) *PropertyFailure {
	code := "io-error"
	switch {
	case errors.Is(err, ErrRootNotFound):
		code = "root-not-found"
	case errors.Is(err, ErrRootUnavailable):
		code = "root-unavailable"
	case errors.Is(err, ErrPathTraversal):
		code = "path-traversal"
	case errors.Is(err, ErrPathNotFound), os.IsNotExist(err):
		code = "path-not-found"
	case errors.Is(err, ErrNotFile), errors.Is(err, ErrNotDirectory):
		code = "unsupported-file-type"
	case errors.Is(err, context.Canceled):
		code = "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		code = "deadline-exceeded"
	case os.IsPermission(err):
		code = "permission-denied"
	}
	return &PropertyFailure{Code: code, Message: err.Error()}
}
