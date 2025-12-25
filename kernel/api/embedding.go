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

	if !embedding.IsOllamaEnabled() {
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

// embeddingBlocksPushWithVectors 使用前端预计算向量推送块嵌入
// 不调用 Ollama，直接校验维度后入库
func embeddingBlocksPushWithVectors(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	// 解析 blocks 数组
	blocksRaw, ok := body["blocks"].([]interface{})
	if !ok || len(blocksRaw) == 0 {
		ret["code"] = -1
		ret["msg"] = "blocks 参数必填"
		return
	}

	// 必须指定维度
	dimension := 0
	if d, ok := body["dimension"].(float64); ok {
		dimension = int(d)
	}
	if dimension <= 0 {
		ret["code"] = -1
		ret["msg"] = "dimension 必须大于 0"
		return
	}

	// 必须指定模型名（用于确定集合）
	model := ""
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}
	if model == "" {
		ret["code"] = -1
		ret["msg"] = "model 参数必填"
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

	// 解析 blocks
	blocks := make([]embedding.BlockWithVector, 0, len(blocksRaw))
	for _, bRaw := range blocksRaw {
		b, ok := bRaw.(map[string]interface{})
		if !ok {
			continue
		}

		id, _ := b["id"].(string)
		if id == "" {
			continue
		}

		vectorRaw, _ := b["vector"].([]interface{})
		if len(vectorRaw) != dimension {
			continue
		}

		vector := make([]float32, len(vectorRaw))
		for i, v := range vectorRaw {
			if f, ok := v.(float64); ok {
				vector[i] = float32(f)
			}
		}

		blocks = append(blocks, embedding.BlockWithVector{
			ID:     id,
			Vector: vector,
		})
	}

	if len(blocks) == 0 {
		ret["code"] = -1
		ret["msg"] = "没有有效的块数据"
		return
	}

	pushed, skipped, err := embedding.PushBlocksWithVectors(blocks, dataset, model, dimension, force)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"pushed":    pushed,
		"skipped":   skipped,
		"model":     model,
		"dimension": dimension,
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

	if !embedding.IsOllamaEnabled() {
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

	// model 参数必填，避免默认使用 Ollama 模型导致混淆
	model := ""
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}
	if model == "" {
		ret["code"] = -1
		ret["msg"] = "model 参数必填"
		return
	}

	// ids 参数可选 (精准同步名单)
	var ids []string
	if idsRaw, ok := body["ids"].([]interface{}); ok {
		for _, idRaw := range idsRaw {
			if id, ok := idRaw.(string); ok {
				ids = append(ids, id)
			}
		}
	}

	// force 参数可选（强制重新嵌入，跳过 hash 检查）
	force := false
	if f, ok := body["force"].(bool); ok {
		force = f
	}

	pending, total := embedding.GetPendingBlocksWithModel(dataset, box, limit, model, ids, force)
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

	if !embedding.IsOllamaEnabled() {
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

	if !embedding.IsOllamaEnabled() {
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

	if !embedding.IsOllamaEnabled() {
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

	if !embedding.IsOllamaEnabled() {
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

	if !embedding.IsOllamaEnabled() {
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

// embeddingDatasets 获取所有 embedding 数据集列表
func embeddingDatasets(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	datasets := embedding.ListDatasets()
	ret["data"] = map[string]interface{}{
		"datasets": datasets,
	}
}

// embeddingBlocksEmbedded 获取已嵌入块列表
func embeddingBlocksEmbedded(c *gin.Context) {
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

	// model 参数必填
	model := ""
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}
	if model == "" {
		ret["code"] = -1
		ret["msg"] = "model 参数必填"
		return
	}

	limit := 100
	if l, ok := body["limit"].(float64); ok {
		limit = int(l)
	}

	offset := 0
	if o, ok := body["offset"].(float64); ok {
		offset = int(o)
	}

	blocks, total := embedding.GetEmbeddedBlocksWithModel(dataset, model, limit, offset)
	ret["data"] = map[string]interface{}{
		"blocks": blocks,
		"total":  total,
		"model":  model,
	}
}

// embeddingAssetsPushWithVectors 使用前端预计算向量推送素材嵌入
func embeddingAssetsPushWithVectors(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	// 解析 assets 数组
	assetsRaw, ok := body["assets"].([]interface{})
	if !ok || len(assetsRaw) == 0 {
		ret["code"] = -1
		ret["msg"] = "assets 参数必填"
		return
	}

	// 必须指定维度
	dimension := 0
	if d, ok := body["dimension"].(float64); ok {
		dimension = int(d)
	}
	if dimension <= 0 {
		ret["code"] = -1
		ret["msg"] = "dimension 必须大于 0"
		return
	}

	// 必须指定模型名
	model := ""
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}
	if model == "" {
		ret["code"] = -1
		ret["msg"] = "model 参数必填"
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

	// 解析 assets
	assets := make([]embedding.AssetWithVector, 0, len(assetsRaw))
	for _, aRaw := range assetsRaw {
		a, ok := aRaw.(map[string]interface{})
		if !ok {
			continue
		}

		path, _ := a["path"].(string)
		if path == "" {
			continue
		}

		vectorRaw, _ := a["vector"].([]interface{})
		if len(vectorRaw) != dimension {
			continue
		}

		vector := make([]float32, len(vectorRaw))
		for i, v := range vectorRaw {
			if f, ok := v.(float64); ok {
				vector[i] = float32(f)
			}
		}

		assets = append(assets, embedding.AssetWithVector{
			Path:   path,
			Vector: vector,
		})
	}

	if len(assets) == 0 {
		ret["code"] = -1
		ret["msg"] = "没有有效的素材数据"
		return
	}

	pushed, skipped, err := embedding.PushAssetsWithVectors(assets, dataset, model, dimension, force)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"pushed":    pushed,
		"skipped":   skipped,
		"model":     model,
		"dimension": dimension,
	}
}

// embeddingCollectionsDelete 删除 embedding 集合（两阶段确认）
func embeddingCollectionsDelete(c *gin.Context) {
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	// collection_type: blocks 或 assets
	collectionType := ""
	if t, ok := body["collection_type"].(string); ok && t != "" {
		collectionType = t
	}
	if collectionType != "blocks" && collectionType != "assets" {
		ret["code"] = -1
		ret["msg"] = "collection_type 必须是 blocks 或 assets"
		return
	}

	// model 参数必填
	model := ""
	if m, ok := body["model"].(string); ok && m != "" {
		model = m
	}
	if model == "" {
		ret["code"] = -1
		ret["msg"] = "model 参数必填"
		return
	}

	result, err := embedding.RequestDeleteCollection(collectionType, model)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	ret["data"] = result
}
