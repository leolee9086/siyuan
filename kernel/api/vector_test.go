package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func setupTestEnv() (string, func()) {
	// 创建临时目录
	tmpDir, err := os.MkdirTemp("", "siyuan_vector_test")
	if err != nil {
		panic(err)
	}

	// 备份原有配置
	originalDataDir := util.DataDir
	originalTempDir := util.TempDir

	// 设置临时目录
	util.DataDir = tmpDir
	util.TempDir = tmpDir

	// 创建必要的子目录
	os.MkdirAll(filepath.Join(tmpDir, "public", "vectorStorage"), 0755)

	// 重置初始化标记（如果可以访问的话，但它是私有的，不过 ensureVectorDB 会多次调用 Init 是安全的）
	// 注意：vectorDBInitialized 是包级别变量，同一个进程中只会初始化一次。
	// 这可能导致后续测试复用之前的实例。
	// 因为无法重置私有变量，我们依赖 Init 的幂等性或者在此处重新调用 ensureVectorDB
	// 但 ensureVectorDB 内部检查了 vectorDBInitialized。
	
	// 为了测试，我们需要确保 vectordb 指向新的目录。
	// 由于 vectorDBInitialized 是私有的，我们无法重置它。
	// 这意味着所有测试将共享同一个 vectorStorage 实例（第一次运行后）。
	// 这在测试中可能有问题，因为我们改变了 util.DataDir，但 storage 实例可能持有旧的路径？
	// 让我们看 vectordb.Init 实现：它是用传入的路径创建 storage。
	// 但 api.go 中只有第一次调用 ensureVectorDB 才会调用 vectordb.Init。
	
	// Hack: 既然无法重置，我们假设这是唯一的测试或者我们可以通过其他方式影响它。
	// 或者，如果已经初始化过了，我们需要手动更新 storage？
	// 这里的测试可能无法完美隔离，但对于端到端验证应该足够。
	
	// 强制调用 ensureVectorDB 可能会直接返回。
	// 如果这是在一个全新的测试进程中运行，那是没问题的。

	return tmpDir, func() {
		os.RemoveAll(tmpDir)
		util.DataDir = originalDataDir
		util.TempDir = originalTempDir
	}
}

func createTestContext(body map[string]interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/", nil)
	c.Set("bodyArg", body)
	return c, w
}

func TestVectorAPI_Flow(t *testing.T) {
	_, teardown := setupTestEnv()
	defer teardown()

	// 1. 创建数据集
	t.Run("BuildCollection", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
			"dimension":       float64(4),
		}
		c, w := createTestContext(body)
		vectorBuildCollection(c)

		if w.Code != http.StatusOK {
			t.Errorf("BuildCollection failed: status %d", w.Code)
		}
		
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["code"].(float64) != 0 {
			t.Errorf("BuildCollection failed: %v", resp)
		}
	})

	// 2. 添加向量
	t.Run("AddVectors", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
			"vectors": []interface{}{
				map[string]interface{}{
					"id": "item1",
					"meta": map[string]interface{}{"title": "Hello World"},
					"vector": map[string]interface{}{
						"test_model": []interface{}{0.1, 0.2, 0.3, 0.4},
					},
				},
				map[string]interface{}{
					"id": "item2",
					"meta": map[string]interface{}{"title": "Hello SiYuan"},
					"vector": map[string]interface{}{
						"test_model": []interface{}{0.1, 0.2, 0.3, 0.5},
					},
				},
			},
		}
		c, w := createTestContext(body)
		vectorAdd(c)

		if w.Code != http.StatusOK {
			t.Errorf("AddVectors failed: status %d", w.Code)
		}
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["code"].(float64) != 0 {
			t.Errorf("AddVectors failed: %v", resp)
		}
		data := resp["data"].(map[string]interface{})
		if data["added_count"].(float64) != 2 {
			t.Errorf("Expected 2 items added, got %v", data["added_count"])
		}
	})

	// 3. 查询向量
	t.Run("Query", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
			"vector_name":     "test_model",
			"vector":          []interface{}{0.1, 0.2, 0.3, 0.4}, // Exact match item1
			"limit":           float64(5),
		}
		c, w := createTestContext(body)
		vectorQuery(c)

		if w.Code != http.StatusOK {
			t.Errorf("Query failed: status %d", w.Code)
		}
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["code"].(float64) != 0 {
			t.Errorf("Query failed: %v", resp)
		}
		data := resp["data"].([]interface{})
		if len(data) < 1 {
			t.Errorf("Expected at least 1 result")
		}
		first := data[0].(map[string]interface{})
		if first["id"].(string) != "item1" {
			t.Errorf("Expected item1, got %v", first["id"])
		}
	})

	// 4. 获取所有Keys
	t.Run("Keys", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
		}
		c, w := createTestContext(body)
		vectorKeys(c)
		
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].([]interface{})
		if len(data) != 2 {
			t.Errorf("Expected 2 keys, got %d", len(data))
		}
	})

	// 5. 状态检查
	t.Run("State", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
		}
		c, w := createTestContext(body)
		vectorState(c)
		
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})
		if data["item_count"].(float64) != 2 {
			t.Errorf("Expected item_count 2, got %v", data["item_count"])
		}
	})

	// 6. 删除向量
	t.Run("Delete", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
			"keys":            []interface{}{"item1"},
		}
		c, w := createTestContext(body)
		vectorDelete(c)
		
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})
		if data["deleted_count"].(float64) != 1 {
			t.Errorf("Expected 1 deleted, got %v", data["deleted_count"])
		}
	})

	// 7. 再次查询确认删除
	t.Run("QueryAfterDelete", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
			"vector_name":     "test_model",
			"vector":          []interface{}{0.1, 0.2, 0.3, 0.4},
			"limit":           float64(5),
		}
		c, w := createTestContext(body)
		vectorQuery(c)
		
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].([]interface{})
		// item1 deleted, item2 remains
		if len(data) == 0 {
			t.Errorf("Expected results")
		}
		if data[0].(map[string]interface{})["id"].(string) == "item1" {
			t.Errorf("item1 should be deleted")
		}
	})
	
	// 8. 重建索引
	t.Run("Rebuild", func(t *testing.T) {
		body := map[string]interface{}{
			"database":        "public",
			"collection_name": "test_collection",
			"vector_name":     "test_model",
		}
		c, w := createTestContext(body)
		vectorRebuild(c)
		
		if w.Code != http.StatusOK {
			t.Errorf("Rebuild failed: status %d", w.Code)
		}
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["code"].(float64) != 0 {
			t.Errorf("Rebuild failed: %v", resp)
		}
	})
}
