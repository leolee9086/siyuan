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

// Package embedding 提供语义嵌入服务，支持块和素材的向量化
package embedding

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/kernel/vectordb"
)

// GetBlocksCollectionName 获取块嵌入集合名称（包含模型名）
// 使用默认数据集 "default"
func GetBlocksCollectionName(model string) string {
	return GetBlocksCollectionNameWithDataset(model, "default")
}

// GetBlocksCollectionNameWithDataset 获取块嵌入集合名称（包含模型名和数据集ID）
func GetBlocksCollectionNameWithDataset(model, datasetId string) string {
	// 将模型名和数据集ID中的特殊字符替换为下划线
	safeName := strings.ReplaceAll(model, ":", "_")
	safeName = strings.ReplaceAll(safeName, "/", "_")
	safeDataset := strings.ReplaceAll(datasetId, ":", "_")
	safeDataset = strings.ReplaceAll(safeDataset, "/", "_")
	if safeDataset == "" || safeDataset == "default" {
		return fmt.Sprintf("blocks_embedding_%s", safeName)
	}
	return fmt.Sprintf("blocks_embedding_%s_%s", safeName, safeDataset)
}

// GetAssetsCollectionName 获取素材嵌入集合名称（包含模型名）
// 使用默认数据集 "default"
func GetAssetsCollectionName(model string) string {
	return GetAssetsCollectionNameWithDataset(model, "default")
}

// GetAssetsCollectionNameWithDataset 获取素材嵌入集合名称（包含模型名和数据集ID）
func GetAssetsCollectionNameWithDataset(model, datasetId string) string {
	safeName := strings.ReplaceAll(model, ":", "_")
	safeName = strings.ReplaceAll(safeName, "/", "_")
	safeDataset := strings.ReplaceAll(datasetId, ":", "_")
	safeDataset = strings.ReplaceAll(safeDataset, "/", "_")
	if safeDataset == "" || safeDataset == "default" {
		return fmt.Sprintf("assets_embedding_%s", safeName)
	}
	return fmt.Sprintf("assets_embedding_%s_%s", safeName, safeDataset)
}

// IsEmbeddingReservedCollection 检查是否为 embedding 专用集合
// 这些集合只能通过 embedding 包的接口修改
func IsEmbeddingReservedCollection(name string) bool {
	return strings.HasPrefix(name, "blocks_embedding_") ||
		strings.HasPrefix(name, "assets_embedding_")
}

// DatasetInfo 数据集信息
type DatasetInfo struct {
	Name           string `json:"name"`           // 数据集名称（从向量元数据读取）
	CollectionName string `json:"collectionName"` // 完整集合名
	Type           string `json:"type"`           // blocks 或 assets
	Model          string `json:"model"`          // 模型名（从向量元数据读取）
	Dimension      int    `json:"dimension"`      // 向量维度
	Count          int    `json:"count"`          // 向量数量
}

// ListDatasets 列出所有 embedding 专用数据集
func ListDatasets() []DatasetInfo {
	ensureVectorDB()
	if vectordb.GlobalDB == nil {
		return []DatasetInfo{}
	}

	var datasets []DatasetInfo
	for _, colInfo := range vectordb.GlobalDB.ListCollections() {
		if !IsEmbeddingReservedCollection(colInfo.Name) {
			continue
		}

		info := DatasetInfo{
			CollectionName: colInfo.Name,
			Dimension:      colInfo.Dimension,
			Count:          colInfo.Count,
		}

		// 从集合元数据中读取 model、dataset 和 type
		col := vectordb.GlobalDB.GetCollection(colInfo.Name)
		if col != nil {
			if hc, ok := col.(*vectordb.Collection); ok {
				info.Model = hc.Meta.Model
				info.Name = hc.Meta.Dataset
				info.Type = hc.Meta.Type
			}
			if info.Type == "" {
				if strings.HasPrefix(colInfo.Name, "blocks_embedding_") {
					info.Type = "blocks"
				} else if strings.HasPrefix(colInfo.Name, "assets_embedding_") {
					info.Type = "assets"
				}
			}
			if info.Name == "" {
				info.Name = "default"
			}
		}

		datasets = append(datasets, info)
	}
	return datasets
}

// EmbeddedBlock 已嵌入块信息
type EmbeddedBlock struct {
	BlockID  string                 `json:"blockId"`
	VectorID string                 `json:"vectorId"`
	Hash     string                 `json:"hash"`
	Meta     map[string]interface{} `json:"meta"`
}

// GetEmbeddedBlocksWithModel 获取已完成嵌入的块列表
// dataset: 数据集名称
// model: 模型名称
// limit: 限制数量，0 表示不限制
// offset: 偏移量
func GetEmbeddedBlocksWithModel(dataset string, model string, limit, offset int) ([]EmbeddedBlock, int) {
	ensureVectorDB()
	if vectordb.GlobalDB == nil {
		return []EmbeddedBlock{}, 0
	}

	collectionName := GetBlocksCollectionNameWithDataset(model, dataset)
	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		return []EmbeddedBlock{}, 0
	}

	var result []EmbeddedBlock
	total := 0
	datasetSuffix := "_" + dataset

	col.ForEachID(func(vectorID string, _ uint64, metaBytes []byte) bool {
		if !strings.HasSuffix(vectorID, datasetSuffix) {
			return true
		}
		total++

		if total <= offset {
			return true
		}
		if limit > 0 && len(result) >= limit {
			return false
		}

		blockID := strings.TrimSuffix(vectorID, datasetSuffix)
		embedded := EmbeddedBlock{
			BlockID:  blockID,
			VectorID: vectorID,
		}

		if len(metaBytes) > 0 {
			var metaMap map[string]interface{}
			if json.Unmarshal(metaBytes, &metaMap) == nil {
				embedded.Meta = metaMap
				if hash, ok := metaMap["hash"].(string); ok {
					embedded.Hash = hash
				}
			}
		}

		result = append(result, embedded)
		return true
	})

	return result, total
}

// ensureVectorDB 确保向量数据库已初始化 (从 api/vector.go 搬迁逻辑实现闭环)
func ensureVectorDB() {
	if vectordb.GlobalDB != nil {
		return
	}
	// 初始化向量数据库到 data/storage/vectordb
	dbPath := filepath.Join(util.DataDir, "storage", "vectordb")
	logging.LogInfof("[Embedding] 正在自动初始化向量数据库: %s", dbPath)
	vectordb.InitGlobalDB(dbPath)

	// 检查加载错误
	if err := vectordb.GetDBLoadError(); err != nil {
		logging.LogWarnf("[Embedding] 向量数据库加载失败，使用空数据库: %v", err)
	} else if vectordb.GlobalDB != nil {
		// 加载成功，记录集合数量
		collections := vectordb.GlobalDB.ListCollections()
		logging.LogInfof("[Embedding] 向量数据库加载成功，共 %d 个集合", len(collections))
	}
}

// EnsureCollection 确保嵌入集合存在（向后兼容，不设置元数据）
func EnsureCollection(name string, dimension int) {
	EnsureCollectionWithMeta(name, dimension, "", "", "")
}

// EnsureCollectionWithMeta 确保嵌入集合存在，并设置集合元数据
// model: 模型名
// dataset: 数据集名
// collectionType: 集合类型 (blocks 或 assets)
func EnsureCollectionWithMeta(name string, dimension int, model, dataset, collectionType string) {
	ensureVectorDB()
	if vectordb.GlobalDB == nil {
		return
	}
	if vectordb.GlobalDB.GetCollection(name) == nil {
		meta := vectordb.CollectionMeta{
			Model:   model,
			Dataset: dataset,
			Type:    collectionType,
		}
		vectordb.GlobalDB.CreateCollectionWithMeta(name, dimension, meta)
	}
}

// HashContent 计算内容 hash
func HashContent(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:8])
}

// GetStatus 获取嵌入服务状态
func GetStatus() map[string]interface{} {
	// 计算当前模型的集合统计
	blocksCount := 0
	assetsCount := 0
	if vectordb.GlobalDB != nil {
		blocksColName := GetBlocksCollectionName(OllamaEmbedModel)
		assetsColName := GetAssetsCollectionName(OllamaEmbedModel)
		if col := vectordb.GlobalDB.GetCollection(blocksColName); col != nil {
			blocksCount = col.ItemCount()
		}
		if col := vectordb.GlobalDB.GetCollection(assetsColName); col != nil {
			assetsCount = col.ItemCount()
		}
	}

	models := GetOllamaModels()
	modelNames := make([]string, len(models))
	for i, m := range models {
		modelNames[i] = m.Name
	}

	return map[string]interface{}{
		"enabled":            IsOllamaEnabled(),
		"version":            GetOllamaVersion(),
		"host":               OllamaHost,
		"model":              OllamaEmbedModel,
		"dimension":          OllamaDimension,
		"blocks_count":       blocksCount,
		"assets_count":       assetsCount,
		"available_models":   modelNames,
		"recommended_models": RecommendedEmbedModels,
	}
}

// PushBlocksOptions 推送块选项
type PushBlocksOptions struct {
	IDs     []string
	Dataset string
	Model   string // 可选，默认使用当前模型
	Force   bool
}

// BlockWithVector 带向量的块信息（用于前端直推）
type BlockWithVector struct {
	ID     string    `json:"id"`
	Vector []float32 `json:"vector"` // 前端预计算的向量
}

// PushBlocksWithVectors 使用前端预计算的向量推送块嵌入
// 不调用 Ollama，直接校验维度后入库
func PushBlocksWithVectors(blocks []BlockWithVector, dataset, model string, dimension int, force bool) (pushed, skipped int, err error) {
	ensureVectorDB()
	if vectordb.GlobalDB == nil {
		err = fmt.Errorf("vectordb not initialized and failed to auto-init")
		return
	}

	collectionName := GetBlocksCollectionNameWithDataset(model, dataset)
	EnsureCollectionWithMeta(collectionName, dimension, model, dataset, "blocks")

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		err = fmt.Errorf("collection %s not found", collectionName)
		return
	}

	// 校验集合维度
	if col.Dimension() != dimension {
		err = fmt.Errorf("dimension mismatch: collection has %d, expected %d", col.Dimension(), dimension)
		return
	}

	for _, b := range blocks {
		// 强校验向量维度：禁止任何维度不符的数据进入
		if len(b.Vector) != dimension {
			err = fmt.Errorf("vector dimension mismatch for block %s: expected %d, got %d", b.ID, dimension, len(b.Vector))
			logging.LogErrorf("[Embedding] 严重错误：%s", err.Error())
			return pushed, skipped, err
		}

		block := sql.GetBlock(b.ID)
		if block == nil {
			skipped++
			continue
		}

		content := block.Content
		if content == "" {
			content = block.Markdown
		}
		if content == "" {
			skipped++
			continue
		}

		contentHash := block.Hash // 严格信任数据库，即使为空也不补救，由上游确保或反馈

		vectorID := fmt.Sprintf("%s_%s", b.ID, dataset)

		if !force {
			if meta, ok := col.GetMetaByID(vectorID); ok {
				var metaMap map[string]interface{}
				if json.Unmarshal(meta, &metaMap) == nil {
					if existingHash, ok := metaMap["hash"].(string); ok && existingHash == contentHash {
						skipped++
						continue
					}
				}
			}
		}

		metaData := map[string]interface{}{
			"block_id": b.ID,
			"dataset":  dataset,
			"hash":     contentHash,
			"type":     block.Type,
			"box":      block.Box,
			"path":     block.Path,
			"model":    model,
			"source":   "frontend", // 标记来源为前端
		}
		metaBytes, _ := json.Marshal(metaData)

		point := vectordb.Point{
			ID:     vectorID,
			Vector: b.Vector,
			Meta:   metaBytes,
		}
		if insertErr := col.InsertPoint(point); insertErr != nil {
			err = fmt.Errorf("insert block %s failed: %w", b.ID, insertErr)
			return
		}
		pushed++
	}

	vectordb.SaveCollection(col, vectordb.GlobalDB.Path)
	return
}

// PushBlocks 推送块嵌入
func PushBlocks(ids []string, dataset string, force bool) (pushed, skipped int, err error) {
	return PushBlocksWithModel(ids, dataset, OllamaEmbedModel, force)
}

// PushBlocksWithModel 使用指定模型推送块嵌入
func PushBlocksWithModel(ids []string, dataset string, model string, force bool) (pushed, skipped int, err error) {
	// 移除 IsOllamaEnabled 校验

	// 检查模型是否存在逻辑可能也需要放宽，或者改为仅在需要后端嵌入时校验
	// 但此处为了彻底跑通前端模型，我们先聚焦于向量提交

	// 检查模型是否存在
	if !HasModel(model) {
		err = fmt.Errorf("model %s not found, please pull it first", model)
		return
	}

	collectionName := GetBlocksCollectionNameWithDataset(model, dataset)
	EnsureCollectionWithMeta(collectionName, OllamaDimension, model, dataset, "blocks")

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		err = fmt.Errorf("collection %s not found", collectionName)
		return
	}

	for _, id := range ids {
		block := sql.GetBlock(id)
		if block == nil {
			skipped++
			continue
		}

		content := block.Content
		if content == "" {
			content = block.Markdown
		}
		if content == "" {
			skipped++
			continue
		}

		contentHash := block.Hash
		vectorID := fmt.Sprintf("%s_%s", id, dataset)

		if !force {
			if meta, ok := col.GetMetaByID(vectorID); ok {
				var metaMap map[string]interface{}
				if json.Unmarshal(meta, &metaMap) == nil {
					if existingHash, ok := metaMap["hash"].(string); ok && existingHash == contentHash {
						skipped++
						continue
					}
				}
			}
		}

		// 使用指定模型生成嵌入
		embedding, embErr := OllamaEmbedWithModel(content, model)
		if embErr != nil {
			err = fmt.Errorf("embed block %s failed: %w", id, embErr)
			return
		}

		metaData := map[string]interface{}{
			"block_id": id,
			"dataset":  dataset,
			"hash":     contentHash,
			"type":     block.Type,
			"box":      block.Box,
			"path":     block.Path,
			"model":    model,
		}
		metaBytes, _ := json.Marshal(metaData)

		point := vectordb.Point{
			ID:     vectorID,
			Vector: embedding,
			Meta:   metaBytes,
		}
		if insertErr := col.InsertPoint(point); insertErr != nil {
			err = fmt.Errorf("insert block %s failed: %w", id, insertErr)
			return
		}
		pushed++
	}

	vectordb.SaveCollection(col, vectordb.GlobalDB.Path)
	return
}

// QueryBlocks 查询相似块
func QueryBlocks(query string, topK int, dataset string) ([]map[string]interface{}, error) {
	return QueryBlocksWithModel(query, topK, dataset, OllamaEmbedModel)
}

// QueryBlocksWithModel 使用指定模型查询相似块
func QueryBlocksWithModel(query string, topK int, dataset string, model string) ([]map[string]interface{}, error) {
	if vectordb.GlobalDB == nil {
		return []map[string]interface{}{}, nil
	}

	collectionName := GetBlocksCollectionName(model)
	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		return []map[string]interface{}{}, nil
	}

	queryVec, err := OllamaEmbedWithModel(query, model)
	if err != nil {
		return nil, fmt.Errorf("embed query failed: %w", err)
	}

	results := col.Search(queryVec, topK, 0)

	ret := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		var metaMap map[string]interface{}
		if r.Meta != nil {
			json.Unmarshal(r.Meta, &metaMap)
		}

		if metaMap != nil {
			if ds, ok := metaMap["dataset"].(string); ok && ds != dataset {
				continue
			}
		}

		blockID := ""
		if metaMap != nil {
			if bid, ok := metaMap["block_id"].(string); ok {
				blockID = bid
			}
		}

		block := sql.GetBlock(blockID)
		content := ""
		hpath := ""
		if block != nil {
			content = block.Content
			hpath = block.HPath
		}

		ret = append(ret, map[string]interface{}{
			"id":      blockID,
			"score":   r.Score,
			"content": content,
			"hpath":   hpath,
			"meta":    metaMap,
		})
	}

	return ret, nil
}

// QueryBlocksWithVector 使用前端预计算向量查询相似块
// 不调用 Ollama，直接用传入的向量进行搜索
func QueryBlocksWithVector(queryVec []float32, topK int, dataset string, model string) ([]map[string]interface{}, error) {
	if vectordb.GlobalDB == nil {
		return []map[string]interface{}{}, nil
	}

	collectionName := GetBlocksCollectionNameWithDataset(model, dataset)
	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		return []map[string]interface{}{}, nil
	}

	// 校验向量维度
	if col.Dimension() != len(queryVec) {
		return nil, fmt.Errorf("vector dimension mismatch: collection has %d, query has %d", col.Dimension(), len(queryVec))
	}

	results := col.Search(queryVec, topK, 0)

	ret := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		var metaMap map[string]interface{}
		if r.Meta != nil {
			json.Unmarshal(r.Meta, &metaMap)
		}

		// 检查 dataset 匹配（如果有元数据）
		if metaMap != nil {
			if ds, ok := metaMap["dataset"].(string); ok && ds != dataset {
				continue
			}
		}

		blockID := ""
		if metaMap != nil {
			if bid, ok := metaMap["block_id"].(string); ok {
				blockID = bid
			}
		}

		block := sql.GetBlock(blockID)
		if block == nil {
			// 块不存在，跳过
			continue
		}

		content := block.Content
		if content == "" {
			content = block.Markdown
		}

		ret = append(ret, map[string]interface{}{
			"id":      blockID,
			"score":   r.Score,
			"content": content,
			"hpath":   block.HPath,
			"meta":    metaMap,
			// 新增完整块信息
			"type":   block.Type,
			"box":    block.Box,
			"rootID": block.RootID,
			"name":   block.Name,
			"alias":  block.Alias,
			"memo":   block.Memo,
			"tag":    block.Tag,
			"ial":    block.IAL,
		})
	}

	return ret, nil
}

// PendingBlock 待嵌入块信息
// PendingBlock 待处理块信息（直接承载 SQL 行的所有属性）
type PendingBlock map[string]interface{}

// GetPendingBlocks 获取待嵌入块列表
func GetPendingBlocks(dataset string, box string, limit int) ([]PendingBlock, int) {
	return GetPendingBlocksWithModel(dataset, box, limit, OllamaEmbedModel, nil, false)
}

// determineBlockPendingReason 判定块的待嵌入原因
// 返回值: reason ("表示已嵌入最新版本, "new"/"outdated"表示待嵌入), isMatch (是否hash一致)
func determineBlockPendingReason(blockID, vectorID, contentHash string, col vectordb.VectorCollection) (reason string, isMatch bool) {
	if contentHash == "" {
		logging.LogInfof("[Embedding] 判定报告 - ID:%s, 结论:OUTDATED (数据库无Hash)", blockID)
		return "outdated", false
	}

	if col == nil {
		logging.LogInfof("[Embedding] 判定报告 - ID:%s, 结论:NEW (集合不存在)", blockID)
		return "new", false
	}

	meta, metaExists := col.GetMetaByID(vectorID)
	if !metaExists {
		logging.LogInfof("[Embedding] 判定报告 - ID:%s, 结论:NEW (向量ID不存在:%s)", blockID, vectorID)
		return "new", false
	}

	if len(meta) == 0 {
		logging.LogInfof("[Embedding] 判定报告 - ID:%s, 结论:OUTDATED (Meta丢失)", blockID)
		return "outdated", false
	}

	var metaMap map[string]interface{}
	if err := json.Unmarshal(meta, &metaMap); err != nil {
		logging.LogInfof("[Embedding] 判定报告 - ID:%s, 结论:OUTDATED (Meta解析失败)", blockID)
		return "outdated", false
	}

	// Hash 不匹配
	existingHash, _ := metaMap["hash"].(string)
	if existingHash == "" || existingHash != contentHash {
		logging.LogInfof("[Embedding] 判定报告 - ID:%s, 结论:OUTDATED (Hash不匹配: DB='%s', Vector='%s')", blockID, contentHash, existingHash)
		return "outdated", false
	}

	// Hash 一致，不需要重新嵌入
	return "", true
}

// GetPendingBlocksWithModel 使用指定模型获取待嵌入块列表
// dataset: 数据集名称
// box: 笔记本 ID (可选)
// limit: 限制获取数量
// model: 模型名称
// ids: 明确指定的块 ID 名单 (可选，若提供则仅扫描这些块)
// force: 是否强制重新嵌入（跳过 hash 检查）
func GetPendingBlocksWithModel(dataset string, box string, limit int, model string, ids []string, force bool) ([]PendingBlock, int) {
	logging.LogInfof("[Embedding] API 入口接头成功 - 数据集:%s, 模型:%s, 块ID数:%d", dataset, model, len(ids))

	// 如果指定了 ids，说明是精准查询，应该忽略 limit 限制（或者说 limit 至少要是 len(ids)）
	// 这样才能保证前端请求的每一个 ID 都能拿到状态
	if len(ids) > 0 {
		limit = len(ids)
	}

	ensureVectorDB()

	if vectordb.GlobalDB == nil {
		logging.LogInfof("[Embedding] 严重错误：vectordb.GlobalDB 初始化后仍为空！")
		pending := []PendingBlock{}
		for _, blockID := range ids {
			if len(pending) < limit {
				pending = append(pending, PendingBlock{"id": blockID, "reason": "db_init_failed"})
			}
		}
		return pending, len(ids)
	}

	collectionName := GetBlocksCollectionNameWithDataset(model, dataset)
	col := vectordb.GlobalDB.GetCollection(collectionName)
	// 如果集合不存在，我们先不急着创建，等到真正推送向量时根据前端传来的维度创建
	// 这样可以避免默认用 1024 维度创建了集合，导致前端 768 维度的向量推不进去
	if col != nil {
		logging.LogInfof("[Embedding] 发现现有集合: %s, 维度: %d", collectionName, col.Dimension())
	} else {
		logging.LogInfof("[Embedding] 警告：集合 %s 尚不存在，将返回全部为 NEW", collectionName)
	}

	var result []map[string]interface{}
	if len(ids) > 0 {
		// 1. 精准查询名单内的块
		blocks := sql.GetBlocks(ids)
		for _, b := range blocks {
			if b == nil {
				continue
			}
			row := map[string]interface{}{
				"id":        b.ID,
				"parent_id": b.ParentID,
				"root_id":   b.RootID,
				"hash":      b.Hash,
				"box":       b.Box,
				"path":      b.Path,
				"hpath":     b.HPath,
				"name":      b.Name,
				"alias":     b.Alias,
				"memo":      b.Memo,
				"tag":       b.Tag,
				"content":   b.Content,
				"fcontent":  b.FContent,
				"markdown":  b.Markdown,
				"length":    b.Length,
				"type":      b.Type,
				"subtype":   b.SubType,
				"ial":       b.IAL,
				"sort":      b.Sort,
				"created":   b.Created,
				"updated":   b.Updated,
			}
			result = append(result, row)
		}
	}

	// 关键哨兵日志：确认数据库是否吐出了数据
	logging.LogInfof("[Embedding] 数据库查询结果统计 - 数据集:%s, 请求ID数:%d, 实际命中数:%d", dataset, len(ids), len(result))
	if len(result) > 0 {
		logging.LogInfof("[Embedding] 数据库首条数据样例 - ID:%v, ContentSize:%d", result[0]["id"], len(result[0]["content"].(string)))
	} else {
		logging.LogInfof("[Embedding] 警告：SQL 返回结果为空！IDS: %v", ids)
	}

	total := 0
	pending := []PendingBlock{}
	matchCount := 0
	hitBlockIDs := make(map[string]bool) // Keep this as it's used later
	skipCount := 0                       // Keep this as it's used later

	// 建立 ID -> Row 的映射，方便快速查找
	rowsMap := make(map[string]map[string]interface{})
	if len(result) > 0 {
		for _, row := range result {
			if id, ok := row["id"].(string); ok && id != "" {
				rowsMap[id] = row
			}
		}
	}

	// 核心修正：必须遍历传入的 ids，而不是数据库查到的结果
	// 数据库查不到的，也要作为 new 处理（或者根据业务逻辑处理，但不能吞掉）
	for _, id := range ids {
		if id == "" {
			continue
		}

		hitBlockIDs[id] = true
		reason := ""

		row, inDB := rowsMap[id]
		if !inDB {
			logging.LogInfof("[Embedding] 警告：ID %s 在 SQL 查询中未命中", id)
			reason = "new"

			// Initialize row to avoid panic when setting reason later
			row = map[string]interface{}{
				"id": id,
			}
		} else {
			// 数据库查到了，正常逻辑
			content, _ := row["content"].(string)
			if content == "" {
				if m, ok := row["markdown"].(string); ok {
					content = m
				}
			}

			// 如果是强制重新嵌入，跳过 hash 检查
			if force {
				reason = "force"
			} else {
				// 使用提取的辅助函数判定待嵌入原因
				vectorID := fmt.Sprintf("%s_%s", id, dataset)
				contentHash, _ := row["hash"].(string)
				var isMatch bool
				reason, isMatch = determineBlockPendingReason(id, vectorID, contentHash, col)
				if isMatch {
					matchCount++
					if matchCount <= 3 {
						logging.LogInfof("[Embedding] 采样一致 - ID:%s, Hash:%s", id, contentHash)
					}
				}
			}
		}

		if reason != "" {
			total++
			if len(pending) < limit {
				// 将判定理由注入到 block 属性中
				row["reason"] = reason
				pending = append(pending, row)
			}
		} else {
			skipCount++
		}
	}

	logging.LogInfof("[Embedding] 最终统计 - 数据集:%s, Total:%d (待处理), Pending列表:%d, 一致跳过:%d, 数据库查到总数:%d",
		dataset, total, len(pending), matchCount, len(result))

	// 3. 数据清算 (Scrubbing / Logical Delete)
	// 凡是落在该数据集下，但不在本次名单中的 ID，标记为假删除
	if col != nil && len(ids) > 0 {
		var toDelete []string

		col.ForEachID(func(vectorID string, _ uint64, _ []byte) bool {
			datasetSuffix := "_" + dataset
			if strings.HasSuffix(vectorID, datasetSuffix) {
				blockID := strings.TrimSuffix(vectorID, datasetSuffix)
				inRequest := false
				for _, reqID := range ids {
					if reqID == blockID {
						inRequest = true
						break
					}
				}
				if !inRequest {
					toDelete = append(toDelete, vectorID)
				}
			}
			return true
		})

		if len(toDelete) > 0 {
			for _, vid := range toDelete {
				col.DeleteItemWithIndex(vid)
			}
			vectordb.SaveCollection(col, vectordb.GlobalDB.Path)
		}
	}

	return pending, total
}

// PushAssets 推送素材嵌入
func PushAssets(paths []string, dataset string, force bool) (pushed, skipped int, err error) {
	return PushAssetsWithModel(paths, dataset, OllamaEmbedModel, force)
}

// PushAssetsWithModel 使用指定模型推送素材嵌入
func PushAssetsWithModel(paths []string, dataset string, model string, force bool) (pushed, skipped int, err error) {
	if !IsOllamaEnabled() {
		err = fmt.Errorf("ollama not enabled")
		return
	}

	collectionName := GetAssetsCollectionName(model)
	EnsureCollectionWithMeta(collectionName, OllamaDimension, model, dataset, "assets")

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		err = fmt.Errorf("collection %s not found", collectionName)
		return
	}

	for _, path := range paths {
		text := util.GetAssetText(path)
		if text == "" {
			skipped++
			continue
		}

		contentHash := HashContent(text)
		vectorID := fmt.Sprintf("%s_%s", path, dataset)

		if !force {
			if meta, ok := col.GetMetaByID(vectorID); ok {
				var metaMap map[string]interface{}
				if json.Unmarshal(meta, &metaMap) == nil {
					if existingHash, ok := metaMap["hash"].(string); ok && existingHash == contentHash {
						skipped++
						continue
					}
				}
			}
		}

		embedding, embErr := OllamaEmbedWithModel(text, model)
		if embErr != nil {
			err = fmt.Errorf("embed asset %s failed: %w", path, embErr)
			return
		}

		metaData := map[string]interface{}{
			"path":    path,
			"dataset": dataset,
			"hash":    contentHash,
			"model":   model,
		}
		metaBytes, _ := json.Marshal(metaData)

		point := vectordb.Point{
			ID:     vectorID,
			Vector: embedding,
			Meta:   metaBytes,
		}
		if insertErr := col.InsertPoint(point); insertErr != nil {
			err = fmt.Errorf("insert asset %s failed: %w", path, insertErr)
			return
		}
		pushed++
	}

	vectordb.SaveCollection(col, vectordb.GlobalDB.Path)
	return
}

// QueryAssets 查询相似素材
func QueryAssets(query string, topK int, dataset string) ([]map[string]interface{}, error) {
	return QueryAssetsWithModel(query, topK, dataset, OllamaEmbedModel)
}

// QueryAssetsWithModel 使用指定模型查询相似素材
func QueryAssetsWithModel(query string, topK int, dataset string, model string) ([]map[string]interface{}, error) {
	if vectordb.GlobalDB == nil {
		return []map[string]interface{}{}, nil
	}

	collectionName := GetAssetsCollectionName(model)
	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		return []map[string]interface{}{}, nil
	}

	queryVec, err := OllamaEmbedWithModel(query, model)
	if err != nil {
		return nil, fmt.Errorf("embed query failed: %w", err)
	}

	results := col.Search(queryVec, topK, 0)

	ret := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		var metaMap map[string]interface{}
		if r.Meta != nil {
			json.Unmarshal(r.Meta, &metaMap)
		}

		if metaMap != nil {
			if ds, ok := metaMap["dataset"].(string); ok && ds != dataset {
				continue
			}
		}

		path := ""
		if metaMap != nil {
			if p, ok := metaMap["path"].(string); ok {
				path = p
			}
		}

		ret = append(ret, map[string]interface{}{
			"path":  path,
			"score": r.Score,
			"meta":  metaMap,
		})
	}

	return ret, nil
}

// PendingAsset 待嵌入素材信息
type PendingAsset struct {
	Path   string `json:"path"`
	Reason string `json:"reason"`
}

// GetPendingAssets 获取待嵌入素材列表
func GetPendingAssets(dataset string, limit int) ([]PendingAsset, int) {
	// TODO: 需要从 util.assetsTexts 遍历获取有 OCR 文本的素材
	return []PendingAsset{}, 0
}

// AssetWithVector 带向量的素材信息（用于前端直推）
type AssetWithVector struct {
	Path   string    `json:"path"`
	Vector []float32 `json:"vector"` // 前端预计算的向量
}

// PushAssetsWithVectors 使用前端预计算的向量推送素材嵌入
// 不调用 Ollama，直接校验维度后入库
func PushAssetsWithVectors(assets []AssetWithVector, dataset, model string, dimension int, force bool) (pushed, skipped int, err error) {
	if vectordb.GlobalDB == nil {
		err = fmt.Errorf("vectordb not initialized")
		return
	}

	collectionName := GetAssetsCollectionName(model)
	EnsureCollectionWithMeta(collectionName, dimension, model, dataset, "assets")

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		err = fmt.Errorf("collection %s not found", collectionName)
		return
	}

	// 校验集合维度
	if col.Dimension() != dimension {
		err = fmt.Errorf("dimension mismatch: collection has %d, expected %d", col.Dimension(), dimension)
		return
	}

	for _, a := range assets {
		// 校验向量维度
		if len(a.Vector) != dimension {
			skipped++
			continue
		}

		text := util.GetAssetText(a.Path)
		if text == "" {
			skipped++
			continue
		}

		contentHash := HashContent(text)
		vectorID := fmt.Sprintf("%s_%s", a.Path, dataset)

		if !force {
			if meta, ok := col.GetMetaByID(vectorID); ok {
				var metaMap map[string]interface{}
				if json.Unmarshal(meta, &metaMap) == nil {
					if existingHash, ok := metaMap["hash"].(string); ok && existingHash == contentHash {
						skipped++
						continue
					}
				}
			}
		}

		metaData := map[string]interface{}{
			"path":    a.Path,
			"dataset": dataset,
			"hash":    contentHash,
			"model":   model,
			"source":  "frontend", // 标记来源为前端
		}
		metaBytes, _ := json.Marshal(metaData)

		point := vectordb.Point{
			ID:     vectorID,
			Vector: a.Vector,
			Meta:   metaBytes,
		}
		if insertErr := col.InsertPoint(point); insertErr != nil {
			err = fmt.Errorf("insert asset %s failed: %w", a.Path, insertErr)
			return
		}
		pushed++
	}

	vectordb.SaveCollection(col, vectordb.GlobalDB.Path)
	return
}

// =========================================
// 删除数据集 - 两阶段确认机制
// =========================================

// 删除请求记录
var deleteRequests = make(map[string]time.Time)
var deleteRequestsMu sync.RWMutex

// DeleteCollectionResult 删除集合结果
type DeleteCollectionResult struct {
	NeedConfirm    bool   `json:"need_confirm"`    // 是否需要确认（首次请求）
	WaitSeconds    int    `json:"wait_seconds"`    // 需要等待的秒数
	Deleted        bool   `json:"deleted"`         // 是否已删除
	CollectionName string `json:"collection_name"` // 集合名称
}

// RequestDeleteCollection 请求删除数据集（两阶段确认）
// 第一次请求：记录时间，返回需要确认
// 3秒后到30秒内再次请求：执行删除
// 超过30秒：重新开始
func RequestDeleteCollection(collectionType, model string) (result DeleteCollectionResult, err error) {
	var collectionName string
	if collectionType == "blocks" {
		collectionName = GetBlocksCollectionName(model)
	} else if collectionType == "assets" {
		collectionName = GetAssetsCollectionName(model)
	} else {
		err = fmt.Errorf("invalid collection type: %s, must be 'blocks' or 'assets'", collectionType)
		return
	}

	result.CollectionName = collectionName

	deleteRequestsMu.Lock()
	defer deleteRequestsMu.Unlock()

	firstRequest, exists := deleteRequests[collectionName]
	now := time.Now()

	if !exists {
		// 第一次请求，记录时间
		deleteRequests[collectionName] = now
		result.NeedConfirm = true
		result.WaitSeconds = 3
		return
	}

	elapsed := now.Sub(firstRequest)
	if elapsed < 3*time.Second {
		// 太早，需要等待
		result.NeedConfirm = false
		result.WaitSeconds = 3 - int(elapsed.Seconds())
		err = fmt.Errorf("请在 %d 秒后重试", result.WaitSeconds)
		return
	}
	if elapsed > 30*time.Second {
		// 超时，重新开始
		deleteRequests[collectionName] = now
		result.NeedConfirm = true
		result.WaitSeconds = 3
		return
	}

	// 时间窗口内，执行删除
	delete(deleteRequests, collectionName)
	err = doDeleteCollection(collectionName)
	if err == nil {
		result.Deleted = true
	}
	return
}

// doDeleteCollection 实际执行删除集合
func doDeleteCollection(collectionName string) error {
	if vectordb.GlobalDB == nil {
		return fmt.Errorf("vectordb not initialized")
	}

	// 从数据库中移除集合（同时删除持久化文件）
	return vectordb.GlobalDB.DeleteCollection(collectionName)
}
