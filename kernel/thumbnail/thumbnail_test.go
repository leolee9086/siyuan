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

func TestManagerDoesNotRegisterIconAsThumbnailProvider(t *testing.T) {
	m := NewInstance()
	for _, provider := range m.providers {
		if provider.Name() == "FileIcon" {
			t.Fatal("file icons must not be returned from the thumbnail service")
		}
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
