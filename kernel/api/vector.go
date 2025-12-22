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
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/kernel/vectordb"
)

// 初始化标记
var vectorDBInitialized = false

// ensureVectorDB 确保向量数据库已初始化
func ensureVectorDB() {
	if vectorDBInitialized {
		return
	}
	
	// 初始化向量数据库
	publicPath := filepath.Join(util.DataDir, "public", "vectorStorage")
	pluginPath := "" // 插件路径稍后处理
	tempPath := filepath.Join(util.TempDir, "vectorStorage")
	
	vectordb.Init(publicPath, pluginPath, tempPath)
	vectorDBInitialized = true
}

func vectorBuildCollection(c *gin.Context) {
	ensureVectorDB()
	
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	arg, ok := c.Get("bodyArg")
	if !ok {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}
	
	body := arg.(map[string]interface{})
	database, _ := body["database"].(string)
	if database == "" {
		database = "public"
	}
	collectionName, _ := body["collection_name"].(string)
	dimension := int(body["dimension"].(float64))
	
	if collectionName == "" {
		ret["code"] = -1
		ret["msg"] = "collection_name 不能为空"
		return
	}
	
	// 创建数据集
	db := vectordb.GetDatabase(database)
	if db == nil {
		ret["code"] = -1
		ret["msg"] = "数据库不存在"
		return
	}
	
	collection := vectordb.NewCollection(collectionName, dimension)
	db.Collections[collectionName] = collection
	
	ret["data"] = map[string]interface{}{
		"collection_name": collectionName,
		"dimension":       dimension,
	}
}

func vectorAdd(c *gin.Context) {
	ensureVectorDB()
	
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	arg, ok := c.Get("bodyArg")
	if !ok {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}
	
	body := arg.(map[string]interface{})
	database, _ := body["database"].(string)
	if database == "" {
		database = "public"
	}
	collectionName, _ := body["collection_name"].(string)
	vectorsRaw, _ := body["vectors"].([]interface{})
	
	collection := vectordb.GetCollection(database, collectionName)
	if collection == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}
	
	addedCount := 0
	for _, vRaw := range vectorsRaw {
		v := vRaw.(map[string]interface{})
		id, _ := v["id"].(string)
		meta, _ := v["meta"].(map[string]interface{})
		vectorMap, _ := v["vector"].(map[string]interface{})
		
		item := vectordb.NewItem(id)
		item.Meta = meta
		
		for modelName, vecRaw := range vectorMap {
			vecSlice := vecRaw.([]interface{})
			vec := make([]float32, len(vecSlice))
			for i, val := range vecSlice {
				vec[i] = float32(val.(float64))
			}
			item.SetVector(modelName, vec)
			collection.InitLevelMap(modelName)
			collection.InsertItem(item, modelName)
		}
		addedCount++
	}
	
	ret["data"] = map[string]interface{}{
		"added_count": addedCount,
	}
}

func vectorDelete(c *gin.Context) {
	ensureVectorDB()
	
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	arg, ok := c.Get("bodyArg")
	if !ok {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}
	
	body := arg.(map[string]interface{})
	database, _ := body["database"].(string)
	if database == "" {
		database = "public"
	}
	collectionName, _ := body["collection_name"].(string)
	keysRaw, _ := body["keys"].([]interface{})
	
	collection := vectordb.GetCollection(database, collectionName)
	if collection == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}
	
	deletedCount := 0
	for _, keyRaw := range keysRaw {
		key := keyRaw.(string)
		for modelName := range collection.HNSWLevelMap {
			collection.DeleteItemWithIndex(key, modelName)
		}
		deletedCount++
	}
	
	ret["data"] = map[string]interface{}{
		"deleted_count": deletedCount,
	}
}

func vectorQuery(c *gin.Context) {
	ensureVectorDB()
	
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	arg, ok := c.Get("bodyArg")
	if !ok {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}
	
	body := arg.(map[string]interface{})
	database, _ := body["database"].(string)
	if database == "" {
		database = "public"
	}
	collectionName, _ := body["collection_name"].(string)
	vectorName, _ := body["vector_name"].(string)
	vectorRaw, _ := body["vector"].([]interface{})
	limit := int(body["limit"].(float64))
	efSearch := 0
	if raw, ok := body["ef_search"]; ok {
		efSearch = int(raw.(float64))
	}
	
	if limit <= 0 {
		limit = 10
	}
	
	collection := vectordb.GetCollection(database, collectionName)
	if collection == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}
	
	// 转换向量
	queryVec := make([]float32, len(vectorRaw))
	for i, val := range vectorRaw {
		queryVec[i] = float32(val.(float64))
	}
	
	results := collection.Search(queryVec, vectorName, limit, efSearch)
	ret["data"] = results
}

func vectorKeys(c *gin.Context) {
	ensureVectorDB()
	
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	arg, ok := c.Get("bodyArg")
	if !ok {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}
	
	body := arg.(map[string]interface{})
	database, _ := body["database"].(string)
	if database == "" {
		database = "public"
	}
	collectionName, _ := body["collection_name"].(string)
	withMeta, _ := body["with_meta"].(bool)
	
	collection := vectordb.GetCollection(database, collectionName)
	if collection == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}
	
	if withMeta {
		result := make([]map[string]interface{}, 0)
		collection.Mu.RLock()
		for id, item := range collection.Items {
			result = append(result, map[string]interface{}{
				"id":   id,
				"meta": item.Meta,
			})
		}
		collection.Mu.RUnlock()
		ret["data"] = result
	} else {
		keys := make([]string, 0)
		collection.Mu.RLock()
		for id := range collection.Items {
			keys = append(keys, id)
		}
		collection.Mu.RUnlock()
		ret["data"] = keys
	}
}

func vectorState(c *gin.Context) {
	ensureVectorDB()
	
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	arg, ok := c.Get("bodyArg")
	if !ok {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}
	
	body := arg.(map[string]interface{})
	database, _ := body["database"].(string)
	if database == "" {
		database = "public"
	}
	collectionName, _ := body["collection_name"].(string)
	
	collection := vectordb.GetCollection(database, collectionName)
	if collection == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}
	
	models := make([]string, 0)
	for name := range collection.HNSWLevelMap {
		models = append(models, name)
	}
	
	ret["data"] = map[string]interface{}{
		"name":       collection.Name,
		"dimension":  collection.Dimension,
		"item_count": collection.ItemCount(),
		"models":     models,
	}
}

func vectorRebuild(c *gin.Context) {
	ensureVectorDB()
	
	ret := map[string]interface{}{"code": 0}
	defer c.JSON(http.StatusOK, ret)

	arg, ok := c.Get("bodyArg")
	if !ok {
		ret["code"] = -1
		ret["msg"] = "参数解析失败"
		return
	}
	
	body := arg.(map[string]interface{})
	database, _ := body["database"].(string)
	if database == "" {
		database = "public"
	}
	collectionName, _ := body["collection_name"].(string)
	vectorName, _ := body["vector_name"].(string)
	
	collection := vectordb.GetCollection(database, collectionName)
	if collection == nil {
		ret["code"] = -1
		ret["msg"] = "数据集不存在"
		return
	}
	
	if err := collection.RebuildIndex(vectorName); err != nil {
		ret["code"] = -1
		ret["msg"] = err.Error()
		return
	}
	
	ret["msg"] = "索引重建完成"
}
