package thumbnail

import (
	"os"
	"path/filepath"
	"strings"
)

// SVGProvider 保留 SVG 原始字节，避免把矢量资源降级成文件图标或错误的位图。
type SVGProvider struct{}

func NewSVGProvider() *SVGProvider {
	return &SVGProvider{}
}

func (p *SVGProvider) Name() string {
	return "SVG"
}

func (p *SVGProvider) Priority() int {
	return 20
}

func (p *SVGProvider) CanHandle(filePath string) bool {
	return strings.EqualFold(filepath.Ext(filePath), ".svg")
}

func (p *SVGProvider) Generate(filePath string, _, _ int) ([]byte, error) {
	return os.ReadFile(filePath)
}
