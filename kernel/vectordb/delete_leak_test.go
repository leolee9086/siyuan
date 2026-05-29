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

package vectordb

import (
	"fmt"
	"testing"
)

// TestDeleteItemWithIndex_DocMapLeak 验证 DeleteItemWithIndex 后
// ListIDs 不应再返回已删除的 ID，且 ItemCount 与 ListIDs 长度一致。
//
// Bug: Collection.DeleteItemWithIndex 仅清理 IDMap 和 HNSWIdx.Deleted，
// 但未清理 DocMap 和 Metas，导致：
//   - ListIDs() 遍历 DocMap 时仍返回已删除的 ID
//   - ItemCount() 返回 len(IDMap) 与 len(ListIDs()) 不一致
func TestDeleteItemWithIndex_DocMapLeak(t *testing.T) {
	collection := NewCollection("test-leak", 64)

	// 插入 3 个点
	for i := 0; i < 3; i++ {
		vec := make([]float32, 64)
		vec[i] = 1.0 // 不同位置设 1，使向量不完全相同但不影响本测试
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
	collection.DeleteItemWithIndex("item-1")

	// === Bug 表现 1: ListIDs 仍返回已删除的 ID ===
	afterIDs := collection.ListIDs()
	for _, id := range afterIDs {
		if id == "item-1" {
			t.Errorf("BUG 确认: DeleteItemWithIndex 后 ListIDs 仍返回已删除的 item-1, IDs=%v", afterIDs)
		}
	}

	// === Bug 表现 2: ItemCount 与 ListIDs 长度不一致 ===
	afterCount := collection.ItemCount() // len(IDMap) = 2
	if len(afterIDs) != afterCount {
		t.Errorf("BUG 确认: 删除后 ItemCount=%d 但 ListIDs 长度=%d，两者应一致",
			afterCount, len(afterIDs))
	}

	// === Bug 表现 3: 通过 GetDocID 验证 IDMap 已清理（这是正确的）===
	// 但 ListIDs 仍返回，证明 DocMap 未同步清理
	if _, ok := collection.GetDocID("item-1"); ok {
		t.Error("GetDocID('item-1') 应返回 false")
	}
	// 检查 DocMap 中 item-1 是否仍然存在（直接读取内部状态）
	collection.Mu.RLock()
	for docID, id := range collection.DocMap {
		if id == "item-1" {
			t.Errorf("BUG 确认: DocMap[%d] = %q 仍然存在，删除后未清理", docID, id)
		}
	}
	collection.Mu.RUnlock()

	t.Logf("ItemCount=%d, ListIDs=%v", afterCount, afterIDs)

	// === Bug 表现 4: 重新插入相同 ID 后，旧 DocMap 槽位形成空洞 ===
	// 插入回 item-1
	vec := make([]float32, 64)
	vec[0] = 1.0
	NormalizeVector(vec)
	collection.InsertPoint(Point{ID: "item-1", Vector: vec})

	// 此时 DocMap 长度为 4（因为插入复用时 len(c.DocMap) 分配了新 docID），
	// 但实际只有 3 个有效条目，DocMap[1] 是已删除的残留
	collection.Mu.RLock()
	docMapLen := len(collection.DocMap)
	idMapLen := len(collection.IDMap)
	collection.Mu.RUnlock()

	if docMapLen > idMapLen {
		t.Errorf("BUG 确认: 重新插入后 DocMap 长度=%d 大于 IDMap 长度=%d，DocMap 中存在已删除的残留槽位",
			docMapLen, idMapLen)
	}

	t.Logf("重新插入后: DocMap 长度=%d, IDMap 长度=%d", docMapLen, idMapLen)
}
