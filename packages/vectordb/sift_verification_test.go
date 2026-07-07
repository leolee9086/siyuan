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

// 本文件由 kernel/vectordb/sift_verification_test.go 移植，
// 路径已适配 packages/vectordb 的独立模块结构。

package vectordb

import (
	"os"
	"path/filepath"
	"testing"
)

// TestLoadSIFT1M_Verification 验证 SIFT1M 数据集的完整性和格式正确性。
//
// 依赖外部数据集：test_data/sift/sift_base.fvecs（约 500MB），
// 数据集不存在时自动跳过。
func TestLoadSIFT1M_Verification(t *testing.T) {
	// 从 packages/vectordb 出发，两级目录到 s-forge 根目录
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
