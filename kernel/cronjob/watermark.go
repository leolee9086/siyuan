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

package cronjob

import (
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// 获取当前图片水印配置 从思源配置读取水印设置
func 获取当前图片水印配置() *图片水印配置 {
	conf := model.Conf
	if conf == nil || conf.Export == nil {
		return nil
	}

	水印文本 := conf.Export.ImageWatermarkStr
	水印描述 := conf.Export.ImageWatermarkDesc

	if 水印文本 == "" {
		return nil
	}

	是否为图片水印 := strings.HasPrefix(水印文本, "http") ||
		strings.HasSuffix(strings.ToLower(水印文本), ".png") ||
		strings.HasSuffix(strings.ToLower(水印文本), ".jpg") ||
		strings.HasSuffix(strings.ToLower(水印文本), ".jpeg")

	return &图片水印配置{
		水印文本:    水印文本,
		水印描述:    水印描述,
		是否为图片水印: 是否为图片水印,
	}
}

// 为图片添加文字水印 在图片上绘制文字水印
func 为图片添加文字水印(源图片路径 string, 目标路径 string, 水印文本 string) error {
	// 打开源图片
	源文件, err := os.Open(源图片路径)
	if err != nil {
		return err
	}
	defer 源文件.Close()

	// 解码图片
	源图片, 格式, err := image.Decode(源文件)
	if err != nil {
		return err
	}

	// 获取图片尺寸
	bounds := 源图片.Bounds()
	宽度 := bounds.Dx()
	高度 := bounds.Dy()

	// 创建可绘制的图片
	目标图片 := image.NewRGBA(bounds)
	draw.Draw(目标图片, bounds, 源图片, bounds.Min, draw.Src)

	// 计算水印参数
	水印颜色 := color.RGBA{128, 128, 128, 100} // 半透明灰色
	旋转角度 := -45.0                          // 逆时针 45 度

	// 创建水印图层
	水印图层 := 创建文字水印图层(宽度, 高度, 水印文本, 水印颜色, 旋转角度)

	// 合并水印图层
	draw.Draw(目标图片, bounds, 水印图层, image.Point{}, draw.Over)

	// 保存结果
	目标文件, err := os.Create(目标路径)
	if err != nil {
		return err
	}
	defer 目标文件.Close()

	// 根据格式保存
	switch strings.ToLower(格式) {
	case "jpeg", "jpg":
		return jpeg.Encode(目标文件, 目标图片, &jpeg.Options{Quality: 95})
	case "png":
		return png.Encode(目标文件, 目标图片)
	default:
		return png.Encode(目标文件, 目标图片)
	}
}

// 创建文字水印图层 创建一个带有重复文字水印的图层
func 创建文字水印图层(宽度, 高度 int, 文本 string, 颜色 color.RGBA, 旋转角度 float64) *image.RGBA {
	图层 := image.NewRGBA(image.Rect(0, 0, 宽度, 高度))

	// 使用基础字体
	字体面 := basicfont.Face7x13

	// 计算文本尺寸（粗略估计）
	文本宽度 := len(文本) * 7
	文本高度 := 13

	// 计算水印间距
	水平间距 := 文本宽度 * 3
	if 水平间距 < 150 {
		水平间距 = 150
	}
	垂直间距 := 文本高度 * 8
	if 垂直间距 < 100 {
		垂直间距 = 100
	}

	// 旋转后的偏移
	弧度 := 旋转角度 * math.Pi / 180
	cos := math.Cos(弧度)
	sin := math.Sin(弧度)

	// 绘制重复的水印
	for y := -高度; y < 高度*2; y += 垂直间距 {
		for x := -宽度; x < 宽度*2; x += 水平间距 {
			// 计算旋转后的位置
			旋转后X := int(float64(x)*cos - float64(y)*sin)
			旋转后Y := int(float64(x)*sin + float64(y)*cos)

			// 检查是否在图片范围内
			if 旋转后X >= -100 && 旋转后X < 宽度+100 && 旋转后Y >= -50 && 旋转后Y < 高度+50 {
				在图片上绘制文字(图层, 字体面, 旋转后X, 旋转后Y, 文本, 颜色)
			}
		}
	}

	return 图层
}

// 在图片上绘制文字 在指定位置绘制文字
func 在图片上绘制文字(图片 *image.RGBA, 字体面 font.Face, x, y int, 文本 string, 颜色 color.RGBA) {
	点坐标 := fixed.Point26_6{
		X: fixed.I(x),
		Y: fixed.I(y),
	}

	绘制器 := &font.Drawer{
		Dst:  图片,
		Src:  image.NewUniform(颜色),
		Face: 字体面,
		Dot:  点坐标,
	}

	绘制器.DrawString(文本)
}

// 为图片添加图片水印 用另一张图片作为水印
func 为图片添加图片水印(源图片路径 string, 目标路径 string, 水印图片路径 string) error {
	// 打开源图片
	源图片, err := imaging.Open(源图片路径)
	if err != nil {
		return err
	}

	// 打开水印图片
	水印图片, err := imaging.Open(水印图片路径)
	if err != nil {
		return err
	}

	// 获取源图片尺寸
	源尺寸 := 源图片.Bounds()
	宽度 := 源尺寸.Dx()
	高度 := 源尺寸.Dy()

	// 调整水印大小（使其适合平铺）
	水印尺寸 := 水印图片.Bounds()
	水印宽度 := 水印尺寸.Dx()
	水印高度 := 水印尺寸.Dy()

	// 如果水印太大，缩小它
	最大水印尺寸 := 宽度 / 4
	if 水印宽度 > 最大水印尺寸 {
		缩放比例 := float64(最大水印尺寸) / float64(水印宽度)
		水印图片 = imaging.Resize(水印图片, 最大水印尺寸, int(float64(水印高度)*缩放比例), imaging.Lanczos)
		水印宽度 = 水印图片.Bounds().Dx()
		水印高度 = 水印图片.Bounds().Dy()
	}

	// 调整水印透明度
	水印图片 = 调整透明度(水印图片, 0.3)

	// 创建结果图片
	结果图片 := imaging.Clone(源图片)

	// 平铺水印
	间距X := 水印宽度 * 2
	间距Y := 水印高度 * 2

	for y := 0; y < 高度; y += 间距Y {
		for x := 0; x < 宽度; x += 间距X {
			结果图片 = imaging.Overlay(结果图片, 水印图片, image.Pt(x, y), 1.0)
		}
	}

	// 保存结果
	return imaging.Save(结果图片, 目标路径)
}

// 调整透明度 调整图片的整体透明度
func 调整透明度(源图片 image.Image, 透明度 float64) *image.NRGBA {
	bounds := 源图片.Bounds()
	结果 := image.NewNRGBA(bounds)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := 源图片.At(x, y).RGBA()
			结果.SetNRGBA(x, y, color.NRGBA{
				R: uint8(r >> 8),
				G: uint8(g >> 8),
				B: uint8(b >> 8),
				A: uint8(float64(a>>8) * 透明度),
			})
		}
	}

	return 结果
}

// 是否为图片文件 检查文件是否为支持的图片格式
func 是否为图片文件(路径 string) bool {
	扩展名 := strings.ToLower(filepath.Ext(路径))
	switch 扩展名 {
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp":
		return true
	default:
		return false
	}
}

// 处理单个图片 为单个图片添加水印
func 处理单个图片(图片路径 string, 配置 *图片水印配置) error {
	if 配置 == nil || 配置.水印文本 == "" {
		return nil
	}

	// 生成输出路径（在原文件名后加 _watermarked）
	扩展名 := filepath.Ext(图片路径)
	无扩展名 := strings.TrimSuffix(图片路径, 扩展名)
	输出路径 := 无扩展名 + "_watermarked" + 扩展名

	logging.LogInfof("为图片添加水印: %s -> %s", 图片路径, 输出路径)

	if 配置.是否为图片水印 {
		return 为图片添加图片水印(图片路径, 输出路径, 配置.水印文本)
	}
	return 为图片添加文字水印(图片路径, 输出路径, 配置.水印文本)
}

// 批量处理目录中的图片 为目录中所有未处理的图片添加水印
func 批量处理目录中的图片(目录路径 string, 配置 *图片水印配置, 已处理记录 map[string]bool) error {
	return filepath.Walk(目录路径, func(路径 string, 信息 os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录
		if 信息.IsDir() {
			return nil
		}

		// 跳过非图片文件
		if !是否为图片文件(路径) {
			return nil
		}

		// 跳过已添加水印的文件
		if strings.Contains(路径, "_watermarked") {
			return nil
		}

		// 检查是否已处理
		if 已处理记录[路径] {
			return nil
		}

		// 处理图片
		if err := 处理单个图片(路径, 配置); err != nil {
			logging.LogErrorf("处理图片失败 [%s]: %s", 路径, err)
			return nil // 继续处理其他图片
		}

		// 记录已处理
		已处理记录[路径] = true
		return nil
	})
}
