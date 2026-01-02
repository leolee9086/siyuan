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
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
)

// extractAssetPalette 提取素材调色板
//
// POST /api/s-forge/asset-meta/palette
//
// 请求体:
//
//	{
//	  "path": "assets/xxx.png",  // 相对于 data/ 的路径（必需）
//	  "colorCount": 8            // 目标颜色数量，默认 8（可选）
//	}
//
// 响应:
//
//	{
//	  "code": 0,
//	  "msg": "",
//	  "data": {
//	    "palettes": [
//	      {"color": [255, 128, 64], "ratio": 0.35, "h": 20, "s": 75, "l": 62},
//	      ...
//	    ]
//	  }
//	}
//
// 流程：先入库（保存到 JSON + 更新索引），再返回结果
func extractAssetPalette(c *gin.Context) {
	var req struct {
		Path       string `json:"path"`
		ColorCount int    `json:"colorCount"`
		Overwrite  bool   `json:"overwrite"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "invalid request: " + err.Error(),
		})
		return
	}

	// 验证路径
	req.Path = strings.TrimSpace(req.Path)
	if req.Path == "" {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "path is required",
		})
		return
	}

	// 默认颜色数量
	if req.ColorCount <= 0 {
		req.ColorCount = 8
	}
	if req.ColorCount > 16 {
		req.ColorCount = 16
	}

	// 调用服务：先入库后返回
	// ExtractAndStorePalette 内部会：
	// 1. 提取调色板
	// 2. 保存到 JSON 文件
	// 3. 更新 SQLite 索引
	// 4. 返回结果
	service := assetmeta.NewInstance()
	palettes, err := service.ExtractAndStorePalette(req.Path, req.ColorCount, req.Overwrite)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "extract palette failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "",
		"data": gin.H{
			"palettes": palettes,
		},
	})
}

// batchExtractAssetPalettes 批量提取素材调色板
//
// POST /api/s-forge/asset-meta/palette/batch
//
// 请求体:
//
//	{
//	  "paths": ["assets/a.png", "assets/b.jpg", ...],
//	  "colorCount": 8
//	}
//
// 响应:
//
//	{
//	  "code": 0,
//	  "data": {
//	    "results": {
//	      "assets/a.png": {"palettes": [...], "error": ""},
//	      "assets/b.jpg": {"palettes": null, "error": "file not found"}
//	    },
//	    "successCount": 1,
//	    "failCount": 1
//	  }
//	}
func batchExtractAssetPalettes(c *gin.Context) {
	var req struct {
		Paths      []string `json:"paths"`
		ColorCount int      `json:"colorCount"`
		Overwrite  bool     `json:"overwrite"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "invalid request: " + err.Error(),
		})
		return
	}

	if len(req.Paths) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "paths is required",
		})
		return
	}

	// 限制批量数量
	if len(req.Paths) > 100 {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "too many paths, max 100",
		})
		return
	}

	if req.ColorCount <= 0 {
		req.ColorCount = 8
	}
	if req.ColorCount > 16 {
		req.ColorCount = 16
	}

	service := assetmeta.NewInstance()

	type Result struct {
		Palettes []assetmeta.Palette `json:"palettes"`
		Error    string              `json:"error"`
	}

	results := make(map[string]Result, len(req.Paths))
	var successCount, failCount int

	for _, path := range req.Paths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}

		palettes, err := service.ExtractAndStorePalette(path, req.ColorCount, req.Overwrite)
		if err != nil {
			results[path] = Result{Palettes: nil, Error: err.Error()}
			failCount++
		} else {
			results[path] = Result{Palettes: palettes, Error: ""}
			successCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "",
		"data": gin.H{
			"results":      results,
			"successCount": successCount,
			"failCount":    failCount,
		},
	})
}

// getAssetMeta 获取素材元数据
//
// POST /api/s-forge/asset-meta/get
//
// 请求体:
//
//	{
//	  "path": "assets/xxx.png"
//	}
func getAssetMeta(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "invalid request: " + err.Error(),
		})
		return
	}

	req.Path = strings.TrimSpace(req.Path)
	if req.Path == "" {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "path is required",
		})
		return
	}

	service := assetmeta.NewInstance()
	meta, ok := service.GetAssetFromIndex(req.Path)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "asset not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "",
		"data": meta,
	})
}

// setAssetMeta 设置素材元数据
//
// POST /api/s-forge/asset-meta/set
//
// 请求体:
//
//	{
//	  "path": "assets/xxx.png",
//	  "name": "新名称",
//	  "tags": ["标签1", "标签2"],
//	  "star": 3,
//	  "annotation": "注释"
//	}
func setAssetMeta(c *gin.Context) {
	var req struct {
		Path       string   `json:"path"`
		Name       string   `json:"name"`
		Tags       []string `json:"tags"`
		Star       int      `json:"star"`
		Annotation string   `json:"annotation"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "invalid request: " + err.Error(),
		})
		return
	}

	req.Path = strings.TrimSpace(req.Path)
	if req.Path == "" {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "path is required",
		})
		return
	}

	// 星级范围限制
	if req.Star < 0 {
		req.Star = 0
	}
	if req.Star > 5 {
		req.Star = 5
	}

	service := assetmeta.NewInstance()

	// 尝试加载现有元数据
	meta, _ := service.GetAsset(req.Path)

	// 更新字段
	meta.Path = req.Path
	if req.Name != "" {
		meta.Name = req.Name
	}
	if req.Tags != nil {
		meta.Tags = req.Tags
	}
	meta.Star = req.Star
	meta.Annotation = req.Annotation

	// 保存
	if err := service.SetAsset(meta); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": -1,
			"msg":  "save asset meta failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "",
		"data": meta,
	})
}
