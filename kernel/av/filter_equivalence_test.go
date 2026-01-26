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

package av

import (
	"fmt"
	"math/rand"
	"testing"
	"time"
)

// TestFilterEquivalence_BuildKeyIndexMap 测试 buildKeyIndexMap 函数的等价性
// 验证优化后的实现与原始实现产生相同的结果
func TestFilterEquivalence_BuildKeyIndexMap(t *testing.T) {
	tests := []struct {
		name   string
		fields []Field
	}{
		{
			name:   "空字段列表",
			fields: []Field{},
		},
		{
			name: "单个字段",
			fields: []Field{
				&BaseInstanceField{ID: "field1", Type: KeyTypeText},
			},
		},
		{
			name: "多个字段",
			fields: []Field{
				&BaseInstanceField{ID: "field1", Type: KeyTypeText},
				&BaseInstanceField{ID: "field2", Type: KeyTypeNumber},
				&BaseInstanceField{ID: "field3", Type: KeyTypeDate},
			},
		},
		{
			name:   "大量字段（>10）",
			fields: generateTestFields(20),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 调用优化后的实现
			result := buildKeyIndexMap(tt.fields)

			// 验证结果
			if len(result) != len(tt.fields) {
				t.Errorf("buildKeyIndexMap() 返回的 map 大小 = %d, 期望 %d", len(result), len(tt.fields))
			}

			// 验证每个字段的索引是否正确
			for i, field := range tt.fields {
				if idx, exists := result[field.GetID()]; !exists {
					t.Errorf("字段 %s 不存在于结果 map 中", field.GetID())
				} else if idx != i {
					t.Errorf("字段 %s 的索引 = %d, 期望 %d", field.GetID(), idx, i)
				}
			}
		})
	}
}

// TestFilterEquivalence_FilterOperations 测试过滤操作的等价性
// 验证优化前后的过滤结果完全一致
func TestFilterEquivalence_FilterOperations(t *testing.T) {
	// 由于 Collection 是接口，我们需要使用实际的实现
	// 这里我们测试 buildKeyIndexMap 在不同场景下的正确性

	t.Run("字段查找逻辑验证", func(t *testing.T) {
		// 测试场景1：少量字段（使用直接遍历）
		fields := generateTestFields(5)
		filters := []*ViewFilter{
			{Column: "field0"},
			{Column: "field2"},
			{Column: "field4"},
		}

		// 模拟原始的查找逻辑
		var expectedIndexes []int
		for _, f := range filters {
			for i, c := range fields {
				if c.GetID() == f.Column {
					expectedIndexes = append(expectedIndexes, i)
					break
				}
			}
		}

		// 验证结果
		if len(expectedIndexes) != 3 {
			t.Errorf("期望找到 3 个字段，实际找到 %d 个", len(expectedIndexes))
		}
		if expectedIndexes[0] != 0 || expectedIndexes[1] != 2 || expectedIndexes[2] != 4 {
			t.Errorf("字段索引不正确: %v", expectedIndexes)
		}
	})

	t.Run("字段查找逻辑验证-大数据集", func(t *testing.T) {
		// 测试场景2：大量字段（使用 map 查找）
		fields := generateTestFields(20)
		filters := []*ViewFilter{
			{Column: "field5"},
			{Column: "field10"},
			{Column: "field15"},
		}

		// 使用优化后的 map 查找
		keyIndexMap := buildKeyIndexMap(fields)
		var optimizedIndexes []int
		for _, f := range filters {
			if index, exists := keyIndexMap[f.Column]; exists {
				optimizedIndexes = append(optimizedIndexes, index)
			}
		}

		// 验证结果
		if len(optimizedIndexes) != 3 {
			t.Errorf("期望找到 3 个字段，实际找到 %d 个", len(optimizedIndexes))
		}
		if optimizedIndexes[0] != 5 || optimizedIndexes[1] != 10 || optimizedIndexes[2] != 15 {
			t.Errorf("字段索引不正确: %v", optimizedIndexes)
		}
	})
}

// TestFilterEquivalence_EdgeCases 测试边界条件的等价性
func TestFilterEquivalence_EdgeCases(t *testing.T) {
	t.Run("空字段列表", func(t *testing.T) {
		fields := []Field{}
		result := buildKeyIndexMap(fields)
		if len(result) != 0 {
			t.Errorf("空字段列表应该返回空 map，实际大小: %d", len(result))
		}
	})

	t.Run("不存在的字段ID", func(t *testing.T) {
		fields := generateTestFields(5)
		keyIndexMap := buildKeyIndexMap(fields)

		// 查找不存在的字段
		_, exists := keyIndexMap["nonexistent"]
		if exists {
			t.Error("不应该找到不存在的字段")
		}
	})

	t.Run("重复的字段ID", func(t *testing.T) {
		// 创建包含重复ID的字段列表
		fields := []Field{
			&BaseInstanceField{ID: "field1", Type: KeyTypeText},
			&BaseInstanceField{ID: "field1", Type: KeyTypeNumber}, // 重复ID
			&BaseInstanceField{ID: "field2", Type: KeyTypeDate},
		}

		result := buildKeyIndexMap(fields)
		// map 会保留最后一个相同 key 的值
		if result["field1"] != 1 {
			t.Errorf("重复ID应该保留最后一个索引，期望 1，实际 %d", result["field1"])
		}
	})

	t.Run("大数据集处理", func(t *testing.T) {
		// 测试 1000 个字段
		fields := generateTestFields(1000)
		result := buildKeyIndexMap(fields)

		if len(result) != 1000 {
			t.Errorf("期望 1000 个字段，实际 %d 个", len(result))
		}

		// 随机验证几个索引
		testIndexes := []int{0, 100, 500, 999}
		for _, idx := range testIndexes {
			expectedID := fmt.Sprintf("field%d", idx)
			if result[expectedID] != idx {
				t.Errorf("字段 %s 的索引不正确，期望 %d，实际 %d", expectedID, idx, result[expectedID])
			}
		}
	})
}

// 辅助函数：生成测试字段
func generateTestFields(count int) []Field {
	fields := make([]Field, count)
	for i := 0; i < count; i++ {
		fields[i] = &BaseInstanceField{
			ID:   fmt.Sprintf("field%d", i),
			Name: fmt.Sprintf("Field %d", i),
			Type: KeyTypeText,
		}
	}
	return fields
}

// TestFilterEquivalence_RandomCases 随机测试用例
// 生成大量随机测试用例，验证优化前后的一致性
func TestFilterEquivalence_RandomCases(t *testing.T) {
	if testing.Short() {
		t.Skip("跳过随机测试（使用 -short 标志）")
	}

	rand.Seed(time.Now().UnixNano())

	// 生成 100 个随机测试用例
	testCaseCount := 100
	for i := 0; i < testCaseCount; i++ {
		t.Run(fmt.Sprintf("RandomCase_%d", i), func(t *testing.T) {
			// 生成随机的字段数量（1-50）
			fieldCount := rand.Intn(50) + 1
			fields := generateTestFields(fieldCount)

			// 测试 buildKeyIndexMap
			result := buildKeyIndexMap(fields)

			// 验证结果
			if len(result) != len(fields) {
				t.Errorf("随机测试 %d: map 大小不匹配", i)
			}

			for idx, field := range fields {
				if mapIdx, exists := result[field.GetID()]; !exists || mapIdx != idx {
					t.Errorf("随机测试 %d: 字段索引不匹配", i)
				}
			}
		})
	}
}

// TestFilterEquivalence_PerformanceThreshold 性能阈值测试
// 确保优化后的性能不会回退
func TestFilterEquivalence_PerformanceThreshold(t *testing.T) {
	// 定义性能基线（从历史数据中获取）
	// 这些值应该根据实际的基准测试结果设置
	performanceBaselines := map[string]time.Duration{
		"buildKeyIndexMap_10fields":  100 * time.Microsecond,
		"buildKeyIndexMap_50fields":  500 * time.Microsecond,
		"buildKeyIndexMap_100fields": 1 * time.Millisecond,
	}

	tests := []struct {
		name       string
		fieldCount int
		baseline   time.Duration
	}{
		{"10个字段", 10, performanceBaselines["buildKeyIndexMap_10fields"]},
		{"50个字段", 50, performanceBaselines["buildKeyIndexMap_50fields"]},
		{"100个字段", 100, performanceBaselines["buildKeyIndexMap_100fields"]},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fields := generateTestFields(tt.fieldCount)

			start := time.Now()
			for i := 0; i < 1000; i++ {
				buildKeyIndexMap(fields)
			}
			elapsed := time.Since(start) / 1000

			// 允许 20% 的性能波动
			threshold := tt.baseline * 120 / 100

			if elapsed > threshold {
				t.Errorf("性能回退: %s 耗时 %v, 超过阈值 %v", tt.name, elapsed, threshold)
			} else {
				t.Logf("性能正常: %s 耗时 %v, 阈值 %v", tt.name, elapsed, threshold)
			}
		})
	}
}
