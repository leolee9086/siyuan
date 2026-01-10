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

// Package cronjob 提供用户可配置的定时任务功能
// 本文件提供英文别名导出，用于跨包访问
package cronjob

// ========== 编译器相关 ==========

// DocumentCompiler 文档编译器类型别名
type DocumentCompiler = 文档编译器

// NewDocumentCompiler 创建文档编译器的英文别名
var NewDocumentCompiler = 创建文档编译器

// Compile 编译文档 - 编译器方法代理
func (c *DocumentCompiler) Compile(docId string, targetLang string) (string, error) {
	return c.编译文档(docId, targetLang)
}

// ========== 文件夹监听器相关 ==========

// ImageWatermarkWatcher 图片水印监听器类型别名
type ImageWatermarkWatcher = 图片水印监听器

// NewImageWatermarkWatcher 创建图片水印监听器的英文别名
var NewImageWatermarkWatcher = 创建图片水印监听器

// Start 开始监听 - 监听器方法代理
func (w *ImageWatermarkWatcher) Start() error {
	return w.开始()
}

// Stop 停止监听 - 监听器方法代理
func (w *ImageWatermarkWatcher) Stop() {
	w.停止()
}
