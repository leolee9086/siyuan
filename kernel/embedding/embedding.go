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
	"strings"

	"github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/kernel/vectordb"
)

// GetBlocksCollectionName 获取块嵌入集合名称（包含模型名）
func GetBlocksCollectionName(model string) string {
	// 将模型名中的特殊字符替换为下划线
	safeName := strings.ReplaceAll(model, ":", "_")
	safeName = strings.ReplaceAll(safeName, "/", "_")
	return fmt.Sprintf("blocks_embedding_%s", safeName)
}

// GetAssetsCollectionName 获取素材嵌入集合名称（包含模型名）
func GetAssetsCollectionName(model string) string {
	safeName := strings.ReplaceAll(model, ":", "_")
	safeName = strings.ReplaceAll(safeName, "/", "_")
	return fmt.Sprintf("assets_embedding_%s", safeName)
}

// EnsureCollection 确保嵌入集合存在
func EnsureCollection(name string, dimension int) {
	if vectordb.GlobalDB == nil {
		return
	}
	if vectordb.GlobalDB.GetCollection(name) == nil {
		vectordb.GlobalDB.CreateCollection(name, dimension)
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

// PushBlocks 推送块嵌入
func PushBlocks(ids []string, dataset string, force bool) (pushed, skipped int, err error) {
	return PushBlocksWithModel(ids, dataset, OllamaEmbedModel, force)
}

// PushBlocksWithModel 使用指定模型推送块嵌入
func PushBlocksWithModel(ids []string, dataset string, model string, force bool) (pushed, skipped int, err error) {
	if !IsOllamaEnabled() {
		err = fmt.Errorf("ollama not enabled")
		return
	}

	// 检查模型是否存在
	if !HasModel(model) {
		err = fmt.Errorf("model %s not found, please pull it first", model)
		return
	}

	collectionName := GetBlocksCollectionName(model)
	EnsureCollection(collectionName, OllamaDimension)

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

		contentHash := HashContent(content)
		vectorID := fmt.Sprintf("%s_%s", id, dataset)

		if !force {
			if docID, ok := col.GetDocID(vectorID); ok {
				if meta, ok := col.GetMeta(docID); ok {
					var metaMap map[string]interface{}
					if json.Unmarshal(meta, &metaMap) == nil {
						if existingHash, ok := metaMap["hash"].(string); ok && existingHash == contentHash {
							skipped++
							continue
						}
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

// PendingBlock 待嵌入块信息
type PendingBlock struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

// GetPendingBlocks 获取待嵌入块列表
func GetPendingBlocks(dataset string, box string, limit int) ([]PendingBlock, int) {
	return GetPendingBlocksWithModel(dataset, box, limit, OllamaEmbedModel)
}

// GetPendingBlocksWithModel 使用指定模型获取待嵌入块列表
func GetPendingBlocksWithModel(dataset string, box string, limit int, model string) ([]PendingBlock, int) {
	if vectordb.GlobalDB == nil {
		return []PendingBlock{}, 0
	}

	collectionName := GetBlocksCollectionName(model)
	col := vectordb.GlobalDB.GetCollection(collectionName)

	stmt := "SELECT id, content, hash, type, box FROM blocks WHERE type IN ('p', 'h', 'c', 'd')"
	if box != "" {
		stmt += fmt.Sprintf(" AND box = '%s'", box)
	}
	stmt += fmt.Sprintf(" LIMIT %d", limit*2)

	result, _ := sql.QueryNoLimit(stmt)

	pending := make([]PendingBlock, 0)
	total := 0

	for _, row := range result {
		id := row["id"].(string)
		content := ""
		if c, ok := row["content"].(string); ok {
			content = c
		}

		if content == "" {
			continue
		}

		vectorID := fmt.Sprintf("%s_%s", id, dataset)
		contentHash := HashContent(content)
		reason := ""

		if col == nil {
			reason = "new"
		} else {
			docID, exists := col.GetDocID(vectorID)
			if !exists {
				reason = "new"
			} else {
				meta, ok := col.GetMeta(docID)
				if !ok {
					reason = "new"
				} else {
					var metaMap map[string]interface{}
					if json.Unmarshal(meta, &metaMap) == nil {
						if existingHash, ok := metaMap["hash"].(string); ok && existingHash != contentHash {
							reason = "outdated"
						}
					}
				}
			}
		}

		if reason != "" {
			total++
			if len(pending) < limit {
				pending = append(pending, PendingBlock{ID: id, Reason: reason})
			}
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
	EnsureCollection(collectionName, OllamaDimension)

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
			if docID, ok := col.GetDocID(vectorID); ok {
				if meta, ok := col.GetMeta(docID); ok {
					var metaMap map[string]interface{}
					if json.Unmarshal(meta, &metaMap) == nil {
						if existingHash, ok := metaMap["hash"].(string); ok && existingHash == contentHash {
							skipped++
							continue
						}
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
