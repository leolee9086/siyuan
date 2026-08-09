package thumbnail

import (
	"archive/zip"
	"fmt"
	"io"
	"path/filepath"
	"strings"
)

// D5MProvider 读取 D5M 容器内由参考实现约定的 icon.png。
type D5MProvider struct{}

func NewD5MProvider() *D5MProvider {
	return &D5MProvider{}
}

func (p *D5MProvider) Name() string {
	return "D5M"
}

func (p *D5MProvider) Priority() int {
	return 30
}

func (p *D5MProvider) CanHandle(filePath string) bool {
	return strings.EqualFold(filepath.Ext(filePath), ".d5m")
}

func (p *D5MProvider) Generate(filePath string, _, _ int) ([]byte, error) {
	archive, err := zip.OpenReader(filePath)
	if err != nil {
		return nil, err
	}
	defer archive.Close()
	for _, entry := range archive.File {
		if filepath.ToSlash(entry.Name) != "icon.png" {
			continue
		}
		reader, openErr := entry.Open()
		if openErr != nil {
			return nil, openErr
		}
		data, readErr := io.ReadAll(reader)
		closeErr := reader.Close()
		if readErr != nil {
			return nil, readErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		if len(data) == 0 {
			return nil, fmt.Errorf("D5M icon.png is empty")
		}
		return data, nil
	}
	return nil, fmt.Errorf("D5M icon.png not found")
}
