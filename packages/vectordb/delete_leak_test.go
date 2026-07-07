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

// 本文件由 kernel/vectordb/delete_leak_test.go 移植。

package vectordb

import (
	"fmt"
	"testing"
)

// TestDeletePoint_DocMapLeak 验证 DeletePoint 后
// ListIDs 不应再返回已删除的 ID，且 ItemCount 与 ListIDs 长度一致。
func TestDeletePoint_DocMapLeak(t *testing.T) {
	collection := NewCollection("test-leak", 64)

	// 插入 3 个点
	for i := 0; i < 3; i++ {
		vec := make([]float32, 64)
		vec[i] = 1.0
		NormalizeVector(vec)
		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("item-%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("插入 item-%d 失败: %v", i, err)
		}
	}

	// 初始状态一致
	initialCount := collection.ItemCount()
	initialIDs := collection.ListIDs()
	if initialCount != 3 {
		t.Fatalf("初始 ItemCount 应为 3，实际: %d", initialCount)
	}
	if len(initialIDs) != 3 {
		t.Fatalf("初始 ListIDs 长度应为 3，实际: %d", len(initialIDs))
	}

	// 删除 item-1
	collection.DeletePoint("item-1")

	// ListIDs 不应返回已删除的 ID
	afterIDs := collection.ListIDs()
	for _, id := range afterIDs {
		if id == "item-1" {
			t.Errorf("BUG: DeletePoint 后 ListIDs 仍返回已删除的 item-1, IDs=%v", afterIDs)
		}
	}

	// ItemCount 与 ListIDs 长度应一致
	afterCount := collection.ItemCount()
	if len(afterIDs) != afterCount {
		t.Errorf("BUG: 删除后 ItemCount=%d 但 ListIDs 长度=%d，两者应一致",
			afterCount, len(afterIDs))
	}

	// IDMap 应已清理
	if _, ok := collection.GetDocID("item-1"); ok {
		t.Error("GetDocID('item-1') 应返回 false")
	}
}
