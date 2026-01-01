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
	"fmt"
	"path/filepath"
	"strings"
)

// FileIconProvider 为无法生成缩略图的文件生成基于扩展名的图标
// 作为最终的 fallback 方案
type FileIconProvider struct{}

func NewFileIconProvider() *FileIconProvider {
	return &FileIconProvider{}
}

func (p *FileIconProvider) Name() string {
	return "FileIcon"
}

func (p *FileIconProvider) Priority() int {
	return 1000 // 最低优先级
}

func (p *FileIconProvider) CanHandle(filePath string) bool {
	// 总是可以处理任何文件（作为 fallback）
	return true
}

func (p *FileIconProvider) Generate(filePath string, width, height int) (data []byte, err error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	if ext != "" {
		ext = ext[1:] // 移除前导点
	}

	// 限制扩展名长度
	if len(ext) > 6 {
		ext = ext[:6]
	}
	if ext == "" {
		ext = "FILE"
	} else {
		ext = strings.ToUpper(ext)
	}

	svg := generateFileIconSVG(ext, width, height)
	return []byte(svg), nil
}

// 扩展名对应的颜色主题
var extensionColors = map[string]string{
	// 文档类
	"pdf":  "#E53935",
	"doc":  "#2B579A",
	"docx": "#2B579A",
	"xls":  "#217346",
	"xlsx": "#217346",
	"ppt":  "#D24726",
	"pptx": "#D24726",
	"txt":  "#607D8B",
	"rtf":  "#607D8B",
	"md":   "#000000",
	"odt":  "#0E85CD",
	"ods":  "#0E85CD",
	"odp":  "#0E85CD",

	// 压缩包
	"zip": "#FFC107",
	"rar": "#9C27B0",
	"7z":  "#4CAF50",
	"tar": "#795548",
	"gz":  "#795548",

	// 视频
	"mp4":  "#FF5722",
	"mkv":  "#FF5722",
	"avi":  "#FF5722",
	"mov":  "#FF5722",
	"wmv":  "#FF5722",
	"flv":  "#FF5722",
	"webm": "#FF5722",

	// 音频
	"mp3":  "#E91E63",
	"wav":  "#E91E63",
	"flac": "#E91E63",
	"aac":  "#E91E63",
	"ogg":  "#E91E63",
	"m4a":  "#E91E63",

	// 图片（通常不会到这里，但以防万一）
	"psd":  "#31A8FF",
	"ai":   "#FF7F00",
	"eps":  "#FF7F00",
	"svg":  "#FFB13B",
	"webp": "#4CAF50",
	"heic": "#4CAF50",
	"raw":  "#795548",
	"cr2":  "#795548",
	"nef":  "#795548",

	// 代码
	"js":   "#F7DF1E",
	"ts":   "#3178C6",
	"py":   "#3776AB",
	"go":   "#00ADD8",
	"java": "#ED8B00",
	"c":    "#A8B9CC",
	"cpp":  "#00599C",
	"cs":   "#512BD4",
	"rs":   "#DEA584",
	"rb":   "#CC342D",
	"php":  "#777BB4",
	"html": "#E34F26",
	"css":  "#1572B6",
	"json": "#000000",
	"xml":  "#0060AC",
	"sql":  "#336791",
	"sh":   "#4EAA25",

	// 可执行文件
	"exe": "#0078D4",
	"dll": "#0078D4",
	"msi": "#0078D4",
	"app": "#A2AAAD",
	"dmg": "#A2AAAD",

	// 其他
	"iso":     "#607D8B",
	"img":     "#607D8B",
	"torrent": "#43A047",
}

// getColorForExtension 根据扩展名获取颜色
func getColorForExtension(ext string) string {
	ext = strings.ToLower(ext)
	if color, ok := extensionColors[ext]; ok {
		return color
	}
	// 默认颜色：蓝灰色
	return "#546E7A"
}

// generateFileIconSVG 生成文件图标 SVG
// 样式参考系统文件图标，显示折角文件图标和扩展名
func generateFileIconSVG(ext string, width, height int) string {
	color := getColorForExtension(ext)

	// 根据扩展名长度动态调整字体大小
	var fontSize float64
	switch {
	case len(ext) <= 2:
		fontSize = 120
	case len(ext) <= 3:
		fontSize = 100
	case len(ext) <= 4:
		fontSize = 80
	default:
		fontSize = 65
	}

	// 文件图标 SVG
	// 设计：带折角的文件图标 + 扩展名显示
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="%d" height="%d">
  <defs>
    <linearGradient id="fileGrad" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" style="stop-color:#FAFAFA"/>
      <stop offset="100%%" style="stop-color:#E0E0E0"/>
    </linearGradient>
    <filter id="shadow" x="-20%%" y="-20%%" width="140%%" height="140%%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.15"/>
    </filter>
  </defs>
  
  <!-- 文件主体 -->
  <path d="M80,40 L320,40 L400,120 L400,472 Q400,488 384,488 L96,488 Q80,488 80,472 Z" 
        fill="url(#fileGrad)" stroke="#BDBDBD" stroke-width="2" filter="url(#shadow)"/>
  
  <!-- 折角 -->
  <path d="M320,40 L320,104 Q320,120 336,120 L400,120 Z" 
        fill="#BDBDBD"/>
  
  <!-- 折角阴影 -->
  <path d="M320,40 L320,104 Q320,120 336,120 L400,120 L320,40" 
        fill="#9E9E9E" opacity="0.3"/>
  
  <!-- 扩展名背景色块 -->
  <rect x="80" y="290" width="320" height="130" rx="8" fill="%s"/>
  
  <!-- 扩展名文字 -->
  <text x="240" y="375" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif" 
        font-size="%.0f" 
        font-weight="bold" 
        fill="#FFFFFF" 
        text-anchor="middle" 
        dominant-baseline="middle">%s</text>
</svg>`, width, height, color, fontSize, ext)
}
