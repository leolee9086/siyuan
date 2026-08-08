// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package thumbnail

import (
	"strings"
	"testing"
)

func TestDetectContentTypeUsesActualThumbnailBytes(t *testing.T) {
	png := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
	if got := detectContentType(png); got != "image/png" {
		t.Fatalf("PNG bytes must be served as image/png, got %q", got)
	}
	if got := detectContentType([]byte("<svg viewBox=\"0 0 1 1\"></svg>")); got != "image/svg+xml" {
		t.Fatalf("SVG bytes must be served as image/svg+xml, got %q", got)
	}
}

// TestGoImagingProvider_CanHandle 测试 GoImagingProvider 的文件类型判断
func TestGoImagingProvider_CanHandle(t *testing.T) {
	p := NewGoImagingProvider()

	tests := []struct {
		name     string
		filePath string
		want     bool
	}{
		{"jpg file", "/path/to/image.jpg", true},
		{"jpeg file", "/path/to/image.jpeg", true},
		{"png file", "/path/to/image.png", true},
		{"gif file", "/path/to/image.gif", true},
		{"bmp file", "/path/to/image.bmp", true},
		{"tiff file", "/path/to/image.tiff", true},
		{"tif file", "/path/to/image.tif", true},
		{"uppercase JPG", "/path/to/image.JPG", true},
		{"mixed case Png", "/path/to/image.Png", true},
		{"pdf file", "/path/to/document.pdf", false},
		{"docx file", "/path/to/document.docx", false},
		{"mp4 file", "/path/to/video.mp4", false},
		{"no extension", "/path/to/file", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := p.CanHandle(tt.filePath); got != tt.want {
				t.Errorf("CanHandle(%q) = %v, want %v", tt.filePath, got, tt.want)
			}
		})
	}
}

// TestFileIconProvider_CanHandle 测试 FileIconProvider 总是返回 true
func TestFileIconProvider_CanHandle(t *testing.T) {
	p := NewFileIconProvider()

	tests := []string{
		"/path/to/file.pdf",
		"/path/to/file.docx",
		"/path/to/file.mp4",
		"/path/to/file",
		"/path/to/.hidden",
	}

	for _, filePath := range tests {
		if !p.CanHandle(filePath) {
			t.Errorf("FileIconProvider.CanHandle(%q) should always return true", filePath)
		}
	}
}

// TestFileIconProvider_Generate 测试文件图标生成
func TestFileIconProvider_Generate(t *testing.T) {
	p := NewFileIconProvider()

	tests := []struct {
		name    string
		ext     string
		wantSVG bool
	}{
		{"pdf file", "/path/to/file.pdf", true},
		{"docx file", "/path/to/file.docx", true},
		{"unknown ext", "/path/to/file.xyz", true},
		{"long extension", "/path/to/file.verylongext", true},
		{"no extension", "/path/to/file", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := p.Generate(tt.ext, 256, 256)
			if err != nil {
				t.Errorf("Generate() error = %v", err)
				return
			}
			if tt.wantSVG && !strings.Contains(string(data), "<svg") {
				t.Errorf("Generate() should return SVG data")
			}
		})
	}
}

// TestFileIconProvider_ExtensionColors 测试扩展名颜色
func TestFileIconProvider_ExtensionColors(t *testing.T) {
	tests := []struct {
		ext       string
		wantColor string
	}{
		{"pdf", "#E53935"},
		{"docx", "#2B579A"},
		{"unknown", "#546E7A"}, // 默认颜色
	}

	for _, tt := range tests {
		t.Run(tt.ext, func(t *testing.T) {
			color := getColorForExtension(tt.ext)
			if color != tt.wantColor {
				t.Errorf("getColorForExtension(%q) = %v, want %v", tt.ext, color, tt.wantColor)
			}
		})
	}
}

// TestGenerateFileIconSVG 测试 SVG 生成的有效性
func TestGenerateFileIconSVG(t *testing.T) {
	svg := generateFileIconSVG("PDF", 512, 512)

	// 检查是否包含必要的 SVG 元素
	checks := []string{
		`<svg`,
		`viewBox="0 0 512 512"`,
		`PDF`,
		`</svg>`,
	}

	for _, check := range checks {
		if !strings.Contains(svg, check) {
			t.Errorf("SVG should contain %q", check)
		}
	}
}
