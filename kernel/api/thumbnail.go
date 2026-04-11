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

package api

import (
	"net/http"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/thumbnail"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// allowedStaticPrefixes 定义允许访问的静态文件目录前缀
// 与 serve.go 中的静态文件路由保持一致
var allowedStaticPrefixes = []struct {
	prefix  string        // URL 路径前缀
	baseDir func() string // 对应的基础目录
}{
	{"assets/", func() string { return "" }}, // assets 需要特殊处理，使用 model.GetAssetAbsPath
	{"widgets/", func() string { return filepath.Join(util.DataDir, "widgets") }},
	{"plugins/", func() string { return filepath.Join(util.DataDir, "plugins") }},
	{"emojis/", func() string { return filepath.Join(util.DataDir, "emojis") }},
	{"templates/", func() string { return filepath.Join(util.DataDir, "templates") }},
	{"public/", func() string { return filepath.Join(util.DataDir, "public") }},
	{"snippets/", func() string { return util.SnippetsPath }},
	{"appearance/", func() string { return util.AppearancePath }},
}

// getSForgeThumbnail 获取 S-Forge 缩略图
//
// 安全策略：
//   - 仅允许访问静态文件伺服目录下的文件
//   - 使用 model.GetAssetAbsPath（对于 assets）或路径验证（对于其他目录）
//   - 所有路径都必须通过 gulu.File.IsSubPath 检查
//   - 与静态文件路由使用相同的安全策略
//
// 参数:
//   - path: 相对路径（必需，如 "assets/image.png" 或 "emojis/xxx.png"）
//   - size: 最大边长，默认 256，最大 2048（可选）
//   - w: 宽度，与 h 配合使用，优先于 size（可选）
//   - h: 高度，与 w 配合使用，优先于 size（可选）
func getSForgeThumbnail(c *gin.Context) {
	relativePath := c.Query("path")
	if relativePath == "" {
		c.JSON(http.StatusBadRequest, map[string]interface{}{
			"code": -1,
			"msg":  "path is required",
		})
		return
	}

	// 规范化路径，移除前导斜杠
	relativePath = strings.TrimSpace(relativePath)
	relativePath = strings.TrimPrefix(relativePath, "/")

	// 获取绝对路径并验证安全性
	absPath, err := resolveAndValidatePath(relativePath)
	if err != nil {
		logging.LogWarnf("thumbnail path validation failed for [%s]: %v", relativePath, err)
		c.Status(http.StatusNotFound)
		return
	}

	// 解析尺寸参数
	width, height := parseSizeParams(c)

	// 检查是否需要刷新缓存
	refresh := c.Query("refresh") == "true" || c.Query("refresh") == "1"

	// 获取缩略图
	var data []byte
	var contentType string
	if refresh {
		data, contentType, err = thumbnail.NewInstance().Refresh(absPath, width, height)
	} else {
		data, contentType, err = thumbnail.NewInstance().GetWithSize(absPath, width, height)
	}
	if err != nil {
		logging.LogWarnf("get thumbnail failed for [%s]: %v", absPath, err)
		c.Status(http.StatusNotFound)
		return
	}

	// 设置缓存头（如果是刷新则不缓存）
	if refresh {
		c.Header("Cache-Control", "no-cache")
	} else {
		c.Header("Cache-Control", "public, max-age=86400") // 缓存 1 天
	}
	c.Data(http.StatusOK, contentType, data)
}

// resolveAndValidatePath 解析并验证路径的安全性
// 返回绝对路径，如果路径无效或不安全则返回错误
func resolveAndValidatePath(relativePath string) (string, error) {
	// 检查是否匹配任何允许的前缀
	for _, allowed := range allowedStaticPrefixes {
		if !strings.HasPrefix(relativePath, allowed.prefix) {
			continue
		}

		// 特殊处理 assets 目录
		if allowed.prefix == "assets/" {
			// 使用 model.GetAssetAbsPath 进行路径验证
			// 该函数内部会检查文件是否在工作空间内
			absPath, err := model.GetAssetAbsPath(relativePath)
			if err != nil {
				return "", err
			}
			return absPath, nil
		}

		// 其他目录：使用基础目录拼接并验证
		baseDir := allowed.baseDir()
		if baseDir == "" {
			continue
		}

		// 提取相对于基础目录的路径
		subPath := strings.TrimPrefix(relativePath, allowed.prefix)

		// 清理路径，防止路径穿越
		subPath = path.Clean("/" + subPath)
		subPath = strings.TrimPrefix(subPath, "/")

		// 构建绝对路径
		absPath := filepath.Join(baseDir, subPath)

		// 规范化绝对路径
		absPath = filepath.Clean(absPath)

		// 安全检查：必须是基础目录的子路径
		if !gulu.File.IsSubPath(baseDir, absPath) {
			return "", &pathError{msg: "path traversal detected", path: relativePath}
		}

		// 检查文件是否存在
		if !gulu.File.IsExist(absPath) {
			return "", &pathError{msg: "file not found", path: relativePath}
		}

		return absPath, nil
	}

	return "", &pathError{msg: "path not in allowed directories", path: relativePath}
}

// parseSizeParams 解析尺寸参数
func parseSizeParams(c *gin.Context) (width, height int) {
	// 优先使用 w/h 参数
	widthStr := c.Query("w")
	heightStr := c.Query("h")
	if widthStr != "" || heightStr != "" {
		width, _ = strconv.Atoi(widthStr)
		height, _ = strconv.Atoi(heightStr)
	}

	// 如果没有 w/h，使用 size 参数
	if width <= 0 && height <= 0 {
		sizeStr := c.Query("size")
		size, _ := strconv.Atoi(sizeStr)
		if size <= 0 {
			size = 256
		}
		width = size
		height = size
	}

	// 修正默认值和限制
	if width <= 0 {
		width = 256
	}
	if height <= 0 {
		height = 256
	}
	if width > 2048 {
		width = 2048
	}
	if height > 2048 {
		height = 2048
	}

	return width, height
}

// pathError 路径错误
type pathError struct {
	msg  string
	path string
}

func (e *pathError) Error() string {
	return e.msg + ": " + e.path
}

// clearAllThumbnailCache 清除所有缩略图缓存
func clearAllThumbnailCache(c *gin.Context) {
	err := thumbnail.NewInstance().ClearAllCache()
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"code": -1,
			"msg":  err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, map[string]interface{}{
		"code": 0,
		"msg":  "缓存已清除",
	})
}
