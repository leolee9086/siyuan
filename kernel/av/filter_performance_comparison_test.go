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
	"testing"
)

// BenchmarkBuildKeyIndexMap_SmallDataset 基准测试：小数据集（5个字段）
func BenchmarkBuildKeyIndexMap_SmallDataset(b *testing.B) {
	fields := generateBenchmarkFields(5)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildKeyIndexMap(fields)
	}
}

// BenchmarkBuildKeyIndexMap_MediumDataset 基准测试：中等数据集（10个字段）
func BenchmarkBuildKeyIndexMap_MediumDataset(b *testing.B) {
	fields := generateBenchmarkFields(10)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildKeyIndexMap(fields)
	}
}

// BenchmarkBuildKeyIndexMap_LargeDataset 基准测试：大数据集（50个字段）
func BenchmarkBuildKeyIndexMap_LargeDataset(b *testing.B) {
	fields := generateBenchmarkFields(50)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildKeyIndexMap(fields)
	}
}

// BenchmarkBuildKeyIndexMap_VeryLargeDataset 基准测试：超大数据集（100个字段）
func BenchmarkBuildKeyIndexMap_VeryLargeDataset(b *testing.B) {
	fields := generateBenchmarkFields(100)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildKeyIndexMap(fields)
	}
}

// BenchmarkBuildKeyIndexMap_Memory 基准测试：内存分配
func BenchmarkBuildKeyIndexMap_Memory(b *testing.B) {
	fields := generateBenchmarkFields(50)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildKeyIndexMap(fields)
	}
}

// 辅助函数：生成基准测试字段
func generateBenchmarkFields(count int) []Field {
	fields := make([]Field, count)
	for i := 0; i < count; i++ {
		fields[i] = &BaseInstanceField{
			ID:   fmt.Sprintf("field_%d", i),
			Name: fmt.Sprintf("Field %d", i),
			Type: KeyTypeText,
		}
	}
	return fields
}
