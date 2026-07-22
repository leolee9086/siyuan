package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/kernel/vectordb"
)

type vectorHandler func(*gin.Context)

func setupVectorTestEnv(t *testing.T) {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "storage", "vectordb")
	if err := os.MkdirAll(dbPath, 0755); err != nil {
		t.Fatal(err)
	}

	originalDataDir := util.DataDir
	originalTempDir := util.TempDir
	originalDB := vectordb.GlobalDB
	util.DataDir = tmpDir
	util.TempDir = tmpDir
	vectordb.GlobalDB = vectordb.NewDatabase(dbPath)
	t.Cleanup(func() {
		vectordb.GlobalDB = originalDB
		util.DataDir = originalDataDir
		util.TempDir = originalTempDir
	})
}

func callVectorHandler(t *testing.T, handler vectorHandler, body map[string]interface{}) map[string]interface{} {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	handler(ctx)
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected HTTP status %d: %s", recorder.Code, recorder.Body.String())
	}
	response := map[string]interface{}{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("invalid JSON response: %v; body=%s", err, recorder.Body.String())
	}
	if code, ok := response["code"].(float64); !ok || code != 0 {
		t.Fatalf("vector API failed: %v", response)
	}
	return response
}

func responseMap(t *testing.T, response map[string]interface{}) map[string]interface{} {
	t.Helper()
	data, ok := response["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected object response data: %v", response)
	}
	return data
}

func responseSlice(t *testing.T, response map[string]interface{}) []interface{} {
	t.Helper()
	data, ok := response["data"].([]interface{})
	if !ok {
		t.Fatalf("expected array response data: %v", response)
	}
	return data
}

func TestVectorAPI_Flow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupVectorTestEnv(t)

	t.Run("BuildCollection", func(t *testing.T) {
		data := responseMap(t, callVectorHandler(t, vectorBuildCollection, map[string]interface{}{
			"collection_name": "test_collection",
			"dimension":       4,
		}))
		if data["collection_name"] != "test_collection" || data["dimension"] != float64(4) {
			t.Fatalf("unexpected collection response: %v", data)
		}
	})

	t.Run("AddVectors", func(t *testing.T) {
		data := responseMap(t, callVectorHandler(t, vectorAdd, map[string]interface{}{
			"collection_name": "test_collection",
			"points": []map[string]interface{}{
				{"id": "item1", "meta": map[string]interface{}{"title": "Hello World"}, "vector": []float64{0.1, 0.2, 0.3, 0.4}},
				{"id": "item2", "meta": map[string]interface{}{"title": "Hello SiYuan"}, "vector": []float64{0.1, 0.2, 0.3, 0.5}},
			},
		}))
		if data["added_count"] != float64(2) {
			t.Fatalf("expected 2 added points, got %v", data)
		}
	})

	t.Run("Query", func(t *testing.T) {
		results := responseSlice(t, callVectorHandler(t, vectorQuery, map[string]interface{}{
			"collection_name": "test_collection",
			"vector":          []float64{0.1, 0.2, 0.3, 0.4},
			"top_k":           5,
		}))
		if len(results) < 1 || results[0].(map[string]interface{})["id"] != "item1" {
			t.Fatalf("expected item1 as nearest result: %v", results)
		}
	})

	t.Run("KeysAndState", func(t *testing.T) {
		keys := responseSlice(t, callVectorHandler(t, vectorKeys, map[string]interface{}{"collection_name": "test_collection"}))
		if len(keys) != 2 {
			t.Fatalf("expected 2 keys, got %v", keys)
		}
		state := responseMap(t, callVectorHandler(t, vectorState, map[string]interface{}{"collection_name": "test_collection"}))
		if state["item_count"] != float64(2) {
			t.Fatalf("expected item_count=2, got %v", state)
		}
	})

	t.Run("DeleteAndQuery", func(t *testing.T) {
		deleted := responseMap(t, callVectorHandler(t, vectorDelete, map[string]interface{}{
			"collection_name": "test_collection",
			"ids":             []string{"item1"},
		}))
		if deleted["deleted_count"] != float64(1) {
			t.Fatalf("expected one deleted point, got %v", deleted)
		}
		results := responseSlice(t, callVectorHandler(t, vectorQuery, map[string]interface{}{
			"collection_name": "test_collection",
			"vector":          []float64{0.1, 0.2, 0.3, 0.4},
			"top_k":           5,
		}))
		if len(results) != 1 || results[0].(map[string]interface{})["id"] != "item2" {
			t.Fatalf("deleted item remained queryable: %v", results)
		}
	})

	t.Run("Rebuild", func(t *testing.T) {
		callVectorHandler(t, vectorRebuild, map[string]interface{}{"collection_name": "test_collection"})
	})
}
