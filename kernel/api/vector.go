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
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/kernel/vectordb"
)

// isEmbeddingReservedCollection 检查是否为 embedding 专用集合
// 这些集合只能通过 embedding 包的接口修改，通用 vector API 禁止直接操作
func isEmbeddingReservedCollection(name string) bool {
	return strings.HasPrefix(name, "blocks_embedding_") ||
		strings.HasPrefix(name, "assets_embedding_")
}

// ensureVectorDB 确保向量数据库已初始化
func ensureVectorDB() {
	if vectordb.GlobalDB != nil {
		return
	}
	// 设置 SSD 检测结果
	vectordb.IsSSD = util.IsWorkspaceOnSSD()
	// 初始化向量数据库到 data/storage/vectordb
	dbPath := filepath.Join(util.DataDir, "storage", "vectordb")
	vectordb.InitGlobalDB(dbPath)
}

func vectorBuildCollection(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)
	dimension := 0
	if d, ok := body["dimension"].(float64); ok {
		dimension = int(d)
	}

	if collectionName == "" {
		ret["code"] = -1
		ret["msg"] = "collection_name 不能为空"
		return
	}

	// 保护 embedding 专用集合名称
	if isEmbeddingReservedCollection(collectionName) {
		ret["code"] = 403
		ret["msg"] = "Embedding 集合名称受保护，请使用 /api/embedding/* 接口"
		return
	}

	if dimension <= 0 {
		ret["code"] = -1
		ret["msg"] = "dimension 必须大于 0"
		return
	}

	// 创建数据集
	col, err := vectordb.GlobalDB.CreateCollection(collectionName, dimension)
	if err != nil {
		ret["code"] = -1
		ret["msg"] = "创建数据集失败: " + err.Error()
		return
	}

	// 保存
	if err := vectordb.SaveCollection(col, vectordb.GlobalDB.Path); err != nil {
		ret["code"] = -1
		ret["msg"] = "保存数据集失败: " + err.Error()
		return
	}

	ret["data"] = map[string]interface{}{
		"collection_name": collectionName,
		"dimension":       dimension,
	}
}

func vectorAdd(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)
	pointsRaw, _ := body["points"].([]interface{})

	// 保护 embedding 专用集合
	if isEmbeddingReservedCollection(collectionName) {
		ret["code"] = 403
		ret["msg"] = "Embedding 集合受保护，请使用 /api/embedding/* 接口"
		return
	}

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}

	addedCount := 0
	for _, pRaw := range pointsRaw {
		p, ok := pRaw.(map[string]interface{})
		if !ok {
			continue
		}
		id, _ := p["id"].(string)
		vectorRaw, _ := p["vector"].([]interface{})

		// 转换向量
		vec := make([]float32, len(vectorRaw))
		for i, val := range vectorRaw {
			if v, ok := val.(float64); ok {
				vec[i] = float32(v)
			}
		}

		if len(vec) != col.Dimension() {
			continue
		}

		// 构造 Point
		point := vectordb.Point{
			ID:     id,
			Vector: vec,
		}

		// 转换 meta
		if metaRaw, ok := p["meta"]; ok && metaRaw != nil {
			if metaBytes, err := json.Marshal(metaRaw); err == nil {
				point.Meta = json.RawMessage(metaBytes)
			}
		}

		col.InsertPoint(point)
		addedCount++
	}

	// 持久化
	vectordb.SaveCollection(col, vectordb.GlobalDB.Path)

	ret["data"] = map[string]interface{}{
		"added_count": addedCount,
	}
}

func vectorDelete(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)
	idsRaw, _ := body["ids"].([]interface{})

	// 保护 embedding 专用集合
	if isEmbeddingReservedCollection(collectionName) {
		ret["code"] = 403
		ret["msg"] = "Embedding 集合受保护，请使用 /api/embedding/* 接口"
		return
	}

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}

	deletedCount := 0
	for _, idRaw := range idsRaw {
		if id, ok := idRaw.(string); ok {
			col.DeleteItemWithIndex(id)
			deletedCount++
		}
	}

	// 持久化
	vectordb.SaveCollection(col, vectordb.GlobalDB.Path)

	ret["data"] = map[string]interface{}{
		"deleted_count": deletedCount,
	}
}

func vectorQuery(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)
	vectorRaw, _ := body["vector"].([]interface{})
	topK := 10
	if k, ok := body["top_k"].(float64); ok && k > 0 {
		topK = int(k)
	}
	// 兼容旧参数名 limit
	if k, ok := body["limit"].(float64); ok && k > 0 {
		topK = int(k)
	}
	efSearch := 0
	if ef, ok := body["ef_search"].(float64); ok {
		efSearch = int(ef)
	}

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}

	// 转换向量
	queryVec := make([]float32, len(vectorRaw))
	for i, val := range vectorRaw {
		if v, ok := val.(float64); ok {
			queryVec[i] = float32(v)
		}
	}

	if len(queryVec) != col.Dimension() {
		ret["code"] = -1
		ret["msg"] = "向量维度不匹配"
		return
	}

	results := col.Search(queryVec, topK, efSearch)
	ret["data"] = results
}

func vectorKeys(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)
	withMeta, _ := body["with_meta"].(bool)

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}

	if withMeta {
		var result []map[string]interface{}
		col.ForEachID(func(id string, _ uint64, metaBytes []byte) bool {
			item := map[string]interface{}{"id": id}
			if len(metaBytes) > 0 {
				var metaObj interface{}
				if json.Unmarshal(metaBytes, &metaObj) == nil {
					item["meta"] = metaObj
				}
			}
			result = append(result, item)
			return true
		})
		ret["data"] = result
	} else {
		keys := col.ListIDs()
		ret["data"] = keys
	}
}

func vectorState(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}

	ret["data"] = map[string]interface{}{
		"name":       col.Info().Name,
		"dimension":  col.Info().Dimension,
		"item_count": col.ItemCount(),
	}
}

func vectorRebuild(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}

	if err := col.RebuildIndex(); err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}

	// 持久化
	vectordb.SaveCollection(col, vectordb.GlobalDB.Path)

	ret["msg"] = "索引重建完成"
}

func vectorDeleteCollection(c *gin.Context) {
	ensureVectorDB()

	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	body := map[string]interface{}{}
	if err := c.BindJSON(&body); err != nil {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}

	collectionName, _ := body["collection_name"].(string)

	if collectionName == "" {
		ret["code"] = -1
		ret["msg"] = "collection_name 不能为空"
		return
	}

	// 保护 embedding 专用集合
	if isEmbeddingReservedCollection(collectionName) {
		ret["code"] = 403
		ret["msg"] = "Embedding 集合受保护，请使用 /api/embedding/* 接口"
		return
	}

	col := vectordb.GlobalDB.GetCollection(collectionName)
	if col == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}

	// 删除集合
	if err := vectordb.GlobalDB.DeleteCollection(collectionName); err != nil {
		ret["code"] = -1
		ret["msg"] = "删除数据集失败: " + err.Error()
		return
	}

	ret["msg"] = "数据集已删除"
	ret["data"] = map[string]interface{}{
		"collection_name": collectionName,
	}
}
