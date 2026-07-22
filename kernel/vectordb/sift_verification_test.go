package vectordb

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSIFT1M_Verification(t *testing.T) {
	if testing.Short() {
		t.Skip("external million-vector dataset verification")
	}
	// 预期路径: d:\dev\siyuan-note\test_data\sift\sift_base.fvecs
	// 运行路径: d:\dev\siyuan-note\kernel\vectordb
	rootDir := filepath.Join("..", "..", "test_data", "sift")

	basePath := filepath.Join(rootDir, "sift_base.fvecs")
	if _, err := os.Stat(basePath); os.IsNotExist(err) {
		t.Skipf("SIFT1M dataset not found at %s, skipping verification", basePath)
	}

	// 1. Verify Base Vectors
	t.Log("Verifying sift_base.fvecs...")
	baseVecs, dim, err := loadFvecs(basePath)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	if dim != 128 {
		t.Errorf("Base vector dimension mismatch: expected 128, got %d", dim)
	}
	if len(baseVecs) != 1000000 {
		t.Errorf("Base vector count mismatch: expected 1,000,000, got %d", len(baseVecs))
	}

	// 2. Verify Query Vectors
	queryPath := filepath.Join(rootDir, "sift_query.fvecs")
	t.Log("Verifying sift_query.fvecs...")
	queryVecs, dim, err := loadFvecs(queryPath)
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}
	if dim != 128 {
		t.Errorf("Query vector dimension mismatch: expected 128, got %d", dim)
	}
	if len(queryVecs) != 10000 {
		t.Errorf("Query vector count mismatch: expected 10,000, got %d", len(queryVecs))
	}

	// 3. Verify Ground Truth
	gtPath := filepath.Join(rootDir, "sift_groundtruth.ivecs")
	t.Log("Verifying sift_groundtruth.ivecs...")
	gtVecs, dim, err := loadIvecs(gtPath)
	if err != nil {
		t.Fatalf("Failed to load ground truth: %v", err)
	}
	if dim != 100 {
		t.Errorf("Ground truth dimension (K) mismatch: expected 100, got %d", dim)
	}
	if len(gtVecs) != 10000 {
		t.Errorf("Ground truth count mismatch: expected 10,000, got %d", len(gtVecs))
	}

	t.Log("SIFT1M dataset verification passed!")
}
