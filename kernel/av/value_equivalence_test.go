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
	"reflect"
	"testing"

	"github.com/88250/lute/ast"
)

// buildContentsOriginal 是原始版本的BuildContents实现（无缓存）
// 从value.go.original复制，用于等价性测试
func buildContentsOriginal(r *ValueRollup, keyValues []*KeyValues, destKey *Key, relationVal *Value, calc *RollupCalc, furtherCollection Collection) {
	r.Contents = nil
	for _, blockID := range relationVal.Relation.BlockIDs {
		destVal := GetValue(keyValues, destKey.ID, blockID)
		if nil != furtherCollection && (KeyTypeTemplate == destKey.Type || KeyTypeUpdated == destKey.Type || KeyTypeCreated == destKey.Type) {
			destVal = furtherCollection.GetValue(blockID, destKey.ID)
		}

		if nil == destVal {
			if KeyTypeCheckbox == destKey.Type {
				defaultVal := GetAttributeViewDefaultValue(ast.NewNodeID(), destKey.ID, blockID, destKey.Type, false)
				r.Contents = append(r.Contents, defaultVal)
			}
			continue
		}

		if val := destVal.GetValByType(destKey.Type); nil == val || reflect.ValueOf(val).IsNil() {
			continue
		}

		if KeyTypeNumber == destKey.Type {
			destVal.Number.Format = destKey.NumberFormat
			destVal.Number.FormatNumber()
		}

		r.Contents = append(r.Contents, destVal.Clone())
	}

	r.calcContents(calc, destKey)
}

// TestValueRollup_EquivalenceWithOriginal 测试缓存版本与原始版本的功能等价性
func TestValueRollup_EquivalenceWithOriginal(t *testing.T) {
	// 准备测试数据
	keyValues := []*KeyValues{
		{
			Key: &Key{ID: "numKey", Type: KeyTypeNumber, NumberFormat: NumberFormatNone},
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
				{
					ID:      "val3",
					KeyID:   "numKey",
					BlockID: "block3",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 30.0, IsNotEmpty: true},
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
			BlockIDs: []string{"block1", "block2", "block3"},
		},
	}

	// 测试所有计算操作符
	testCases := []struct {
		name     string
		operator CalcOperator
	}{
		{"Sum", CalcOperatorSum},
		{"Average", CalcOperatorAverage},
		{"Min", CalcOperatorMin},
		{"Max", CalcOperatorMax},
		{"CountAll", CalcOperatorCountAll},
		{"CountValues", CalcOperatorCountValues},
		{"CountUniqueValues", CalcOperatorCountUniqueValues},
		{"Median", CalcOperatorMedian},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			calc := &RollupCalc{Operator: tc.operator}

			// 使用原始版本计算
			rollupOriginal := &ValueRollup{}
			buildContentsOriginal(rollupOriginal, keyValues, destKey, relationVal, calc, nil)

			// 使用缓存版本计算（新实例，确保缓存未命中）
			rollupCached := &ValueRollup{}
			rollupCached.BuildContents(keyValues, destKey, relationVal, calc, nil)

			// 比较结果数量
			if len(rollupOriginal.Contents) != len(rollupCached.Contents) {
				t.Errorf("%s: 结果数量不一致，原始版本=%d, 缓存版本=%d",
					tc.name, len(rollupOriginal.Contents), len(rollupCached.Contents))
				return
			}

			// 比较每个结果的值
			for i := range rollupOriginal.Contents {
				origVal := rollupOriginal.Contents[i]
				cachedVal := rollupCached.Contents[i]

				if origVal.Type != cachedVal.Type {
					t.Errorf("%s: 结果类型不一致，索引=%d, 原始=%v, 缓存=%v",
						tc.name, i, origVal.Type, cachedVal.Type)
					continue
				}

				origStr := origVal.String(false)
				cachedStr := cachedVal.String(false)
				if origStr != cachedStr {
					t.Errorf("%s: 结果值不一致，索引=%d, 原始=%s, 缓存=%s",
						tc.name, i, origStr, cachedStr)
				}
			}
		})
	}
}

// TestValueRollup_CacheHitEquivalence 测试缓存命中时结果与原始版本一致
func TestValueRollup_CacheHitEquivalence(t *testing.T) {
	keyValues := []*KeyValues{
		{
			Key: &Key{ID: "numKey", Type: KeyTypeNumber, NumberFormat: NumberFormatNone},
			Values: []*Value{
				{
					ID:      "val1",
					KeyID:   "numKey",
					BlockID: "block1",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 100.0, IsNotEmpty: true},
				},
				{
					ID:      "val2",
					KeyID:   "numKey",
					BlockID: "block2",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 200.0, IsNotEmpty: true},
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

	// 使用原始版本计算期望结果
	rollupOriginal := &ValueRollup{}
	buildContentsOriginal(rollupOriginal, keyValues, destKey, relationVal, calc, nil)
	expectedResult := rollupOriginal.Contents[0].Number.Content

	// 使用缓存版本，第一次调用（缓存未命中）
	rollupCached := &ValueRollup{}
	rollupCached.BuildContents(keyValues, destKey, relationVal, calc, nil)
	firstCallResult := rollupCached.Contents[0].Number.Content

	// 第二次调用（缓存命中）
	rollupCached.BuildContents(keyValues, destKey, relationVal, calc, nil)
	secondCallResult := rollupCached.Contents[0].Number.Content

	// 验证三个结果一致
	if expectedResult != firstCallResult {
		t.Errorf("首次调用结果与原始版本不一致: 期望=%f, 实际=%f", expectedResult, firstCallResult)
	}

	if expectedResult != secondCallResult {
		t.Errorf("缓存命中后结果与原始版本不一致: 期望=%f, 实际=%f", expectedResult, secondCallResult)
	}

	if firstCallResult != secondCallResult {
		t.Errorf("缓存命中前后结果不一致: 首次=%f, 二次=%f", firstCallResult, secondCallResult)
	}
}

// TestValueRollup_DataChangeEquivalence 测试数据变化后结果与原始版本一致
func TestValueRollup_DataChangeEquivalence(t *testing.T) {
	keyValues := []*KeyValues{
		{
			Key: &Key{ID: "numKey", Type: KeyTypeNumber, NumberFormat: NumberFormatNone},
			Values: []*Value{
				{
					ID:      "val1",
					KeyID:   "numKey",
					BlockID: "block1",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 50.0, IsNotEmpty: true},
				},
				{
					ID:      "val2",
					KeyID:   "numKey",
					BlockID: "block2",
					Type:    KeyTypeNumber,
					Number:  &ValueNumber{Content: 50.0, IsNotEmpty: true},
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

	relationVal2 := &Value{
		Type: KeyTypeRelation,
		Relation: &ValueRelation{
			BlockIDs: []string{"block1"}, // 只包含block1
		},
	}

	calc := &RollupCalc{Operator: CalcOperatorSum}

	// 场景1：使用relationVal1
	rollupOriginal1 := &ValueRollup{}
	buildContentsOriginal(rollupOriginal1, keyValues, destKey, relationVal1, calc, nil)

	rollupCached := &ValueRollup{}
	rollupCached.BuildContents(keyValues, destKey, relationVal1, calc, nil)

	if rollupOriginal1.Contents[0].Number.Content != rollupCached.Contents[0].Number.Content {
		t.Errorf("场景1结果不一致: 原始=%f, 缓存=%f",
			rollupOriginal1.Contents[0].Number.Content,
			rollupCached.Contents[0].Number.Content)
	}

	// 场景2：数据变化后使用relationVal2
	rollupOriginal2 := &ValueRollup{}
	buildContentsOriginal(rollupOriginal2, keyValues, destKey, relationVal2, calc, nil)

	rollupCached.BuildContents(keyValues, destKey, relationVal2, calc, nil)

	if rollupOriginal2.Contents[0].Number.Content != rollupCached.Contents[0].Number.Content {
		t.Errorf("场景2结果不一致: 原始=%f, 缓存=%f",
			rollupOriginal2.Contents[0].Number.Content,
			rollupCached.Contents[0].Number.Content)
	}
}
