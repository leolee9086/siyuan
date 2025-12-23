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

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/embedding"
)

// embeddingStatus 获取嵌入服务状态
func embeddingStatus(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	ret["data"] = embedding.GetStatus()
}

// embeddingBlocksPush 推送块嵌入
func embeddingBlocksPush(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	if !embedding.OllamaEnabled {
		ret["code"] = -1
		ret["msg"] = "Ollama 服务未启用"
		return
	}

	idsRaw, ok := body["ids"].([]interface{})
	if !ok || len(idsRaw) == 0 {
		ret["code"] = -1
		ret["msg"] = "ids 参数必填"
		return
	}

	dataset := "default"
	if ds, ok := body["dataset"].(string); ok && ds != "" {
		dataset = ds
	}

	force := false
	if f, ok := body["force"].(bool); ok {
		force = f
	}

	// 允许指定模型
	model := embedding.OllamaEmbedModel
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}

	ids := make([]string, len(idsRaw))
	for i, id := range idsRaw {
		ids[i] = id.(string)
	}

	pushed, skipped, err := embedding.PushBlocksWithModel(ids, dataset, model, force)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"pushed":  pushed,
		"skipped": skipped,
		"model":   model,
	}
}

// embeddingBlocksQuery 查询相似块
func embeddingBlocksQuery(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	if !embedding.OllamaEnabled {
		ret["code"] = -1
		ret["msg"] = "Ollama 服务未启用"
		return
	}

	query, ok := body["query"].(string)
	if !ok || query == "" {
		ret["code"] = -1
		ret["msg"] = "query 参数必填"
		return
	}

	topK := 10
	if k, ok := body["top_k"].(float64); ok {
		topK = int(k)
	}

	dataset := "default"
	if ds, ok := body["dataset"].(string); ok && ds != "" {
		dataset = ds
	}

	model := embedding.OllamaEmbedModel
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}

	results, err := embedding.QueryBlocksWithModel(query, topK, dataset, model)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"results": results,
		"model":   model,
	}
}

// embeddingBlocksPending 获取待嵌入块列表
func embeddingBlocksPending(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	dataset := "default"
	if ds, ok := body["dataset"].(string); ok && ds != "" {
		dataset = ds
	}

	limit := 100
	if l, ok := body["limit"].(float64); ok {
		limit = int(l)
	}

	box := ""
	if b, ok := body["box"].(string); ok {
		box = b
	}

	model := embedding.OllamaEmbedModel
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}

	pending, total := embedding.GetPendingBlocksWithModel(dataset, box, limit, model)
	ret["data"] = map[string]interface{}{
		"pending": pending,
		"total":   total,
		"model":   model,
	}
}

// embeddingAssetsPush 推送素材嵌入
func embeddingAssetsPush(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	if !embedding.OllamaEnabled {
		ret["code"] = -1
		ret["msg"] = "Ollama 服务未启用"
		return
	}

	pathsRaw, ok := body["paths"].([]interface{})
	if !ok || len(pathsRaw) == 0 {
		ret["code"] = -1
		ret["msg"] = "paths 参数必填"
		return
	}

	dataset := "default"
	if ds, ok := body["dataset"].(string); ok && ds != "" {
		dataset = ds
	}

	force := false
	if f, ok := body["force"].(bool); ok {
		force = f
	}

	model := embedding.OllamaEmbedModel
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}

	paths := make([]string, len(pathsRaw))
	for i, p := range pathsRaw {
		paths[i] = p.(string)
	}

	pushed, skipped, err := embedding.PushAssetsWithModel(paths, dataset, model, force)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"pushed":  pushed,
		"skipped": skipped,
		"model":   model,
	}
}

// embeddingAssetsQuery 查询相似素材
func embeddingAssetsQuery(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	if !embedding.OllamaEnabled {
		ret["code"] = -1
		ret["msg"] = "Ollama 服务未启用"
		return
	}

	query, ok := body["query"].(string)
	if !ok || query == "" {
		ret["code"] = -1
		ret["msg"] = "query 参数必填"
		return
	}

	topK := 10
	if k, ok := body["top_k"].(float64); ok {
		topK = int(k)
	}

	dataset := "default"
	if ds, ok := body["dataset"].(string); ok && ds != "" {
		dataset = ds
	}

	model := embedding.OllamaEmbedModel
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}

	results, err := embedding.QueryAssetsWithModel(query, topK, dataset, model)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"results": results,
		"model":   model,
	}
}

// embeddingAssetsPending 获取待嵌入素材列表
func embeddingAssetsPending(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	dataset := "default"
	if ds, ok := body["dataset"].(string); ok && ds != "" {
		dataset = ds
	}

	limit := 100
	if l, ok := body["limit"].(float64); ok {
		limit = int(l)
	}

	pending, total := embedding.GetPendingAssets(dataset, limit)
	ret["data"] = map[string]interface{}{
		"pending": pending,
		"total":   total,
	}
}

// embeddingModels 获取本地模型列表
func embeddingModels(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	if !embedding.OllamaEnabled {
		ret["code"] = -1
		ret["msg"] = "Ollama 服务未启用"
		return
	}

	// 刷新模型列表
	embedding.RefreshOllamaModels()

	ret["data"] = map[string]interface{}{
		"models":             embedding.GetOllamaModels(),
		"current_model":      embedding.OllamaEmbedModel,
		"recommended_models": embedding.RecommendedEmbedModels,
	}
}

// embeddingPullModel 拉取模型
func embeddingPullModel(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	if !embedding.OllamaEnabled {
		ret["code"] = -1
		ret["msg"] = "Ollama 服务未启用"
		return
	}

	model, ok := body["model"].(string)
	if !ok || model == "" {
		ret["code"] = -1
		ret["msg"] = "model 参数必填"
		return
	}

	// 同步拉取（阻塞式）
	err := embedding.OllamaPullModel(model, func(p embedding.OllamaPullProgress) {
		// 可以通过 WebSocket 推送进度，这里暂时忽略
	})
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"model":  model,
		"status": "success",
	}
}

// embeddingSetModel 设置当前嵌入模型
func embeddingSetModel(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	if !embedding.OllamaEnabled {
		ret["code"] = -1
		ret["msg"] = "Ollama 服务未启用"
		return
	}

	model, ok := body["model"].(string)
	if !ok || model == "" {
		ret["code"] = -1
		ret["msg"] = "model 参数必填"
		return
	}

	if err := embedding.SetEmbedModel(model); err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"model":     embedding.OllamaEmbedModel,
		"dimension": embedding.OllamaDimension,
	}
}
