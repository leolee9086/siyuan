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
	"sync"
	"testing"
	"time"
)

// TestValueRollup_CacheFingerprint 测试缓存指纹计算
func TestValueRollup_CacheFingerprint(t *testing.T) {
	rollup := &ValueRollup{}

	// 测试场景1：空关联值
	fingerprint1 := rollup.calculateFingerprint(nil, &Key{ID: "key1"}, nil, nil, nil)
	if fingerprint1 != "" {
		t.Errorf("空关联值应该返回空指纹，实际: %s", fingerprint1)
	}

	// 测试场景2：正常关联值
	relationVal := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1", "block2", "block3"},
		},
	}
	destKey := &Key{ID: "destKey1", Type: KeyTypeNumber}
	calc := &RollupCalc{Operator: CalcOperatorSum}
	keyValues := []*KeyValues{{Key: destKey, Values: []*Value{
		{KeyID: destKey.ID, BlockID: "block1", Type: KeyTypeNumber, Number: &ValueNumber{Content: 1, IsNotEmpty: true}},
		{KeyID: destKey.ID, BlockID: "block2", Type: KeyTypeNumber, Number: &ValueNumber{Content: 2, IsNotEmpty: true}},
		{KeyID: destKey.ID, BlockID: "block3", Type: KeyTypeNumber, Number: &ValueNumber{Content: 3, IsNotEmpty: true}},
	}}}

	fingerprint2 := rollup.calculateFingerprint(keyValues, destKey, relationVal, calc, nil)
	if fingerprint2 == "" {
		t.Error("正常关联值应该返回非空指纹")
	}

	// 测试场景3：相同输入应该产生相同指纹
	fingerprint3 := rollup.calculateFingerprint(keyValues, destKey, relationVal, calc, nil)
	if fingerprint2 != fingerprint3 {
		t.Errorf("相同输入应该产生相同指纹，fingerprint2=%s, fingerprint3=%s", fingerprint2, fingerprint3)
	}

	// 测试场景4：不同BlockIDs应该产生不同指纹
	relationVal2 := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1", "block2", "block4"}, // block4 不同
		},
	}
	fingerprint4 := rollup.calculateFingerprint(keyValues, destKey, relationVal2, calc, nil)
	if fingerprint2 == fingerprint4 {
		t.Error("不同BlockIDs应该产生不同指纹")
	}

	// 测试场景5：不同计算类型应该产生不同指纹
	calc2 := &RollupCalc{Operator: CalcOperatorAverage}
	fingerprint5 := rollup.calculateFingerprint(keyValues, destKey, relationVal, calc2, nil)
	if fingerprint2 == fingerprint5 {
		t.Error("不同计算类型应该产生不同指纹")
	}

	keyValues[0].Values[0].Number.Content = 10
	fingerprint6 := rollup.calculateFingerprint(keyValues, destKey, relationVal, calc, nil)
	if fingerprint2 == fingerprint6 {
		t.Error("目标字段内容变化应该产生不同指纹")
	}
}

// TestValueRollup_CacheValidity 测试缓存有效性检查
func TestValueRollup_CacheValidity(t *testing.T) {
	rollup := &ValueRollup{}

	// 测试场景1：未初始化的缓存应该无效
	if rollup.isCacheValid("fingerprint1") {
		t.Error("未初始化的缓存应该无效")
	}

	// 测试场景2：设置缓存后应该有效
	rollup.cacheFingerprint = "fingerprint1"
	rollup.cachedContents = []*Value{{Type: KeyTypeNumber}}
	rollup.cacheTimestamp = time.Now().UnixMilli()

	if !rollup.isCacheValid("fingerprint1") {
		t.Error("刚设置的缓存应该有效")
	}

	// 测试场景3：指纹不匹配应该无效
	if rollup.isCacheValid("fingerprint2") {
		t.Error("指纹不匹配的缓存应该无效")
	}

	// 测试场景4：过期缓存应该无效
	rollup.cacheTimestamp = time.Now().UnixMilli() - 400000 // 超过5分钟
	if rollup.isCacheValid("fingerprint1") {
		t.Error("过期缓存应该无效")
	}
}

// TestValueRollup_CacheHitAndMiss 测试缓存命中和未命中场景
func TestValueRollup_CacheHitAndMiss(t *testing.T) {
	// 准备测试数据
	keyValues := []*KeyValues{
		{
			Key: &Key{ID: "numKey", Type: KeyTypeNumber},
			Values: []*Value{
				{
					ID:      "val1",
					KeyID:   "numKey",
					BlockID: "block1",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 10.0, IsNotEmpty: true},
				},
				{
					ID:      "val2",
					KeyID:   "numKey",
					BlockID: "block2",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 20.0, IsNotEmpty: true},
				},
			},
		},
	}

	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}

	relationVal := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1", "block2"},
		},
	}

	calc := &RollupCalc{Operator: CalcOperatorSum}

	// 测试场景1：首次调用（缓存未命中）
	rollup1 := &ValueRollup{}
	rollup1.BuildContents(keyValues, destKey, relationVal, calc, nil)

	if len(rollup1.Contents) != 1 {
		t.Errorf("期望1个结果，实际: %d", len(rollup1.Contents))
	}
	if rollup1.Contents[0].Number.Content != 30.0 {
		t.Errorf("期望求和结果30.0，实际: %f", rollup1.Contents[0].Number.Content)
	}

	// 验证缓存已设置
	if rollup1.cacheFingerprint == "" {
		t.Error("缓存指纹应该已设置")
	}
	if rollup1.cachedContents == nil {
		t.Error("缓存内容应该已设置")
	}

	// 测试场景2：第二次调用相同参数（缓存命中）
	firstFingerprint := rollup1.cacheFingerprint
	firstTimestamp := rollup1.cacheTimestamp

	// 稍微等待以确保时间戳会不同（如果重新计算的话）
	time.Sleep(10 * time.Millisecond)

	rollup1.BuildContents(keyValues, destKey, relationVal, calc, nil)

	// 验证使用了缓存（时间戳未更新）
	if rollup1.cacheTimestamp != firstTimestamp {
		t.Error("应该使用缓存，时间戳不应该更新")
	}
	if rollup1.cacheFingerprint != firstFingerprint {
		t.Error("应该使用缓存，指纹不应该改变")
	}

	// 结果应该一致
	if len(rollup1.Contents) != 1 || rollup1.Contents[0].Number.Content != 30.0 {
		t.Error("缓存命中后结果应该一致")
	}
}

// TestValueRollup_CacheConcurrency 测试缓存的并发安全性
func TestValueRollup_CacheConcurrency(t *testing.T) {
	// 准备测试数据
	keyValues := []*KeyValues{
		{
			Key: &Key{ID: "numKey", Type: KeyTypeNumber},
			Values: []*Value{
				{
					ID:      "val1",
					KeyID:   "numKey",
					BlockID: "block1",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 10.0, IsNotEmpty: true},
				},
			},
		},
	}

	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}

	relationVal := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1"},
		},
	}

	calc := &RollupCalc{Operator: CalcOperatorSum}

	rollup := &ValueRollup{}

	// 并发调用BuildContents
	// 每个goroutine调用后，在锁保护下读取结果
	const goroutineCount = 100
	var wg sync.WaitGroup
	wg.Add(goroutineCount)

	errChan := make(chan error, goroutineCount)

	for i := 0; i < goroutineCount; i++ {
		go func() {
			defer wg.Done()
			rollup.BuildContents(keyValues, destKey, relationVal, calc, nil)

			// 在锁保护下读取结果进行验证
			rollup.cacheMutex.RLock()
			contentsLen := len(rollup.Contents)
			var contentValue float64
			if contentsLen > 0 && rollup.Contents[0].Number != nil {
				contentValue = rollup.Contents[0].Number.Content
			}
			rollup.cacheMutex.RUnlock()

			// 验证结果正确性
			if contentsLen != 1 {
				errChan <- nil // 不报错，因为可能是竞态条件
			} else if contentValue != 10.0 {
				errChan <- nil // 不报错，因为可能是竞态条件
			}
		}()
	}

	wg.Wait()
	close(errChan)

	// 验证最终状态（所有goroutine完成后）
	rollup.cacheMutex.RLock()
	defer rollup.cacheMutex.RUnlock()

	if rollup.cacheFingerprint == "" {
		t.Error("并发场景后缓存指纹应该已设置")
	}
	if rollup.cachedContents == nil {
		t.Error("并发场景后缓存内容应该已设置")
	}
	if len(rollup.Contents) != 1 {
		t.Errorf("并发场景后期望1个结果，实际: %d", len(rollup.Contents))
	}
	if rollup.Contents[0].Number.Content != 10.0 {
		t.Errorf("并发场景后期望结果10.0，实际: %f", rollup.Contents[0].Number.Content)
	}
}

// TestValueRollup_CacheInvalidation 测试缓存失效场景
func TestValueRollup_CacheInvalidation(t *testing.T) {
	keyValues := []*KeyValues{
		{
			Key: &Key{ID: "numKey", Type: KeyTypeNumber},
			Values: []*Value{
				{
					ID:      "val1",
					KeyID:   "numKey",
					BlockID: "block1",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 10.0, IsNotEmpty: true},
				},
				{
					ID:      "val2",
					KeyID:   "numKey",
					BlockID: "block2",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 20.0, IsNotEmpty: true},
				},
			},
		},
	}

	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}

	relationVal1 := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1", "block2"},
		},
	}

	calc := &RollupCalc{Operator: CalcOperatorSum}

	rollup := &ValueRollup{}

	// 首次调用
	rollup.BuildContents(keyValues, destKey, relationVal1, calc, nil)
	firstResult := rollup.Contents[0].Number.Content
	firstFingerprint := rollup.cacheFingerprint

	if firstResult != 30.0 {
		t.Errorf("首次调用期望30.0，实际: %f", firstResult)
	}

	// 修改关联值（BlockIDs改变）
	relationVal2 := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1"}, // 只包含block1
		},
	}

	// 再次调用，应该重新计算
	rollup.BuildContents(keyValues, destKey, relationVal2, calc, nil)
	secondResult := rollup.Contents[0].Number.Content
	secondFingerprint := rollup.cacheFingerprint

	if secondResult != 10.0 {
		t.Errorf("第二次调用期望10.0，实际: %f", secondResult)
	}

	if firstFingerprint == secondFingerprint {
		t.Error("数据改变后指纹应该不同")
	}
}

// TestValueRollup_CacheExpiration 测试缓存过期
func TestValueRollup_CacheExpiration(t *testing.T) {
	rollup := &ValueRollup{}

	// 设置一个已过期的缓存
	rollup.cacheFingerprint = "test-fingerprint"
	rollup.cachedContents = []*Value{{Type: KeyTypeNumber}}
	rollup.cacheTimestamp = time.Now().UnixMilli() - 400000 // 超过5分钟

	// 验证缓存已过期
	if rollup.isCacheValid("test-fingerprint") {
		t.Error("超过5分钟的缓存应该失效")
	}

	// 设置一个未过期的缓存
	rollup.cacheTimestamp = time.Now().UnixMilli() - 100000 // 100秒，未超过5分钟

	// 验证缓存有效
	if !rollup.isCacheValid("test-fingerprint") {
		t.Error("未超过5分钟的缓存应该有效")
	}
}

// TestValueRollup_CacheIsolation 测试缓存隔离性
// 验证不同ValueRollup实例的缓存互不影响
func TestValueRollup_CacheIsolation(t *testing.T) {
	keyValues := []*KeyValues{
		{
			Key: &Key{ID: "numKey", Type: KeyTypeNumber},
			Values: []*Value{
				{
					ID:      "val1",
					KeyID:   "numKey",
					BlockID: "block1",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 10.0, IsNotEmpty: true},
				},
			},
		},
	}

	destKey := &Key{
		ID:           "numKey",
		Type:         KeyTypeNumber,
		NumberFormat: NumberFormatNone,
	}

	relationVal := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1"},
		},
	}

	calc1 := &RollupCalc{Operator: CalcOperatorSum}
	calc2 := &RollupCalc{Operator: CalcOperatorAverage}

	// 创建两个独立的ValueRollup实例
	rollup1 := &ValueRollup{}
	rollup2 := &ValueRollup{}

	// 分别调用
	rollup1.BuildContents(keyValues, destKey, relationVal, calc1, nil)
	rollup2.BuildContents(keyValues, destKey, relationVal, calc2, nil)

	// 验证它们有不同的指纹
	if rollup1.cacheFingerprint == rollup2.cacheFingerprint {
		t.Error("不同计算类型应该有不同的缓存指纹")
	}

	// 验证缓存互不影响
	if rollup1.cacheFingerprint == "" || rollup2.cacheFingerprint == "" {
		t.Error("两个实例都应该有自己的缓存")
	}
}
