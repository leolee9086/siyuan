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
	"bytes"
	"image/jpeg"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
)

// GoImagingProvider 使用纯 Go 库处理常见图片格式
// 支持: JPG, PNG, GIF, BMP, TIFF, WEBP (部分)
type GoImagingProvider struct {
	// 支持的扩展名列表
	supportedExts map[string]bool
}

func NewGoImagingProvider() *GoImagingProvider {
	return &GoImagingProvider{
		supportedExts: map[string]bool{
			".jpg":  true,
			".jpeg": true,
			".png":  true,
			".gif":  true,
			".bmp":  true,
			".tif":  true,
			".tiff": true,
			// 注意: Go 标准库不原生支持 WEBP，但 imaging 库有部分支持
		},
	}
}

func (p *GoImagingProvider) Name() string {
	return "GoImaging"
}

func (p *GoImagingProvider) Priority() int {
	return 100 // 中等优先级
}

func (p *GoImagingProvider) CanHandle(filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	return p.supportedExts[ext]
}

// Generate 生成缩略图
// width, height 为目标区域，图片会按比例缩放以适应该区域（保持宽高比）
func (p *GoImagingProvider) Generate(filePath string, width, height int) (data []byte, err error) {
	// 打开图片
	img, err := imaging.Open(filePath, imaging.AutoOrientation(true))
	if err != nil {
		return nil, err
	}

	// 使用 Fit 方法：保持宽高比，缩放到指定区域内
	// 如果 width == height，这就相当于按最大边长缩放
	resizedImg := imaging.Fit(img, width, height, imaging.Lanczos)

	// 编码为 JPEG
	buf := new(bytes.Buffer)
	err = jpeg.Encode(buf, resizedImg, &jpeg.Options{Quality: 85})
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
