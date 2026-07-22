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
	"time"
)

// BenchmarkValueRollup_WithCache 测试有缓存时的性能
func BenchmarkValueRollup_WithCache(b *testing.B) {
	keyValues := createBenchmarkKeyValues(100)
	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}
	relationVal := createBenchmarkRelationVal(50)
	calc := &RollupCalc{Operator: CalcOperatorSum}

	rollup := &ValueRollup{}

	// 预热缓存
	rollup.BuildContents(keyValues, destKey, relationVal, calc, nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rollup.BuildContents(keyValues, destKey, relationVal, calc, nil)
	}
}

// BenchmarkValueRollup_WithoutCache 测试无缓存时的性能（模拟原始实现）
func BenchmarkValueRollup_WithoutCache(b *testing.B) {
	keyValues := createBenchmarkKeyValues(100)
	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}
	relationVal := createBenchmarkRelationVal(50)
	calc := &RollupCalc{Operator: CalcOperatorSum}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// 每次创建新实例，模拟无缓存场景
		rollup := &ValueRollup{}
		rollup.BuildContents(keyValues, destKey, relationVal, calc, nil)
	}
}

// BenchmarkValueRollup_CacheMiss 测试缓存未命中时的性能
func BenchmarkValueRollup_CacheMiss(b *testing.B) {
	keyValues := createBenchmarkKeyValues(100)
	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}
	calc := &RollupCalc{Operator: CalcOperatorSum}

	rollup := &ValueRollup{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// 每次使用不同的relationVal，导致缓存未命中
		relationVal := createBenchmarkRelationVal(50 + (i % 10))
		rollup.BuildContents(keyValues, destKey, relationVal, calc, nil)
	}
}

// TestValueRollup_CachePerformanceComparison 性能对比测试
func TestValueRollup_CachePerformanceComparison(t *testing.T) {
	if testing.Short() {
		t.Skip("performance comparison test")
	}
	keyValues := createBenchmarkKeyValues(100)
	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}
	relationVal := createBenchmarkRelationVal(50)
	calc := &RollupCalc{Operator: CalcOperatorSum}

	const iterations = 1000

	// 测试无缓存场景（每次新建实例）
	startWithoutCache := time.Now()
	for i := 0; i < iterations; i++ {
		rollup := &ValueRollup{}
		rollup.BuildContents(keyValues, destKey, relationVal, calc, nil)
	}
	durationWithoutCache := time.Since(startWithoutCache)

	// 测试有缓存场景（复用实例）
	rollupWithCache := &ValueRollup{}
	// 预热
	rollupWithCache.BuildContents(keyValues, destKey, relationVal, calc, nil)

	startWithCache := time.Now()
	for i := 0; i < iterations; i++ {
		rollupWithCache.BuildContents(keyValues, destKey, relationVal, calc, nil)
	}
	durationWithCache := time.Since(startWithCache)

	// 计算性能提升
	speedup := float64(durationWithoutCache) / float64(durationWithCache)

	t.Logf("性能对比结果 (%d 次迭代):", iterations)
	t.Logf("  无缓存耗时: %v (平均 %v/次)", durationWithoutCache, durationWithoutCache/iterations)
	t.Logf("  有缓存耗时: %v (平均 %v/次)", durationWithCache, durationWithCache/iterations)
	t.Logf("  性能提升: %.2fx", speedup)

	// 验证缓存确实带来了性能提升
	if speedup < 1.5 {
		t.Errorf("缓存性能提升不足，期望至少1.5x，实际: %.2fx", speedup)
	}
}

// 辅助函数：创建基准测试用的KeyValues
func createBenchmarkKeyValues(count int) []*KeyValues {
	values := make([]*Value, count)
	for i := 0; i < count; i++ {
		values[i] = &Value{
			ID:      fmt.Sprintf("val%d", i),
			KeyID:   "numKey",
			BlockID: fmt.Sprintf("block%d", i),
			Type:    KeyTypeNumber,
			Number:  &ValueNumber{Content: float64(i * 10), IsNotEmpty: true},
		}
	}

	return []*KeyValues{
		{
			Key:    &Key{ID: "numKey", Type: KeyTypeNumber},
			Values: values,
		},
	}
}

// 辅助函数：创建基准测试用的RelationVal
func createBenchmarkRelationVal(blockCount int) *Value {
	blockIDs := make([]string, blockCount)
	for i := 0; i < blockCount; i++ {
		blockIDs[i] = fmt.Sprintf("block%d", i)
	}

	return &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: blockIDs,
		},
	}
}
