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

	"github.com/88250/lute/ast"
)

// generateBenchmarkData 生成基准测试数据
// rowCount: 行数
// columnCount: 列数（不包括主键列）
func generateBenchmarkData(rowCount, columnCount int) *Table {
	// 创建表格实例
	table := &Table{
		BaseInstance: &BaseInstance{
			ID:       ast.NewNodeID(),
			Filters:  []*ViewFilter{},
			Sorts:    []*ViewSort{},
			PageSize: 50,
		},
		Columns:  []*TableColumn{},
		Rows:     []*TableRow{},
		RowCount: rowCount,
	}

	// 创建主键列（Block类型）
	blockColumn := &TableColumn{
		BaseInstanceField: &BaseInstanceField{
			ID:   ast.NewNodeID(),
			Name: "Block",
			Type: KeyTypeBlock,
			Icon: "",
		},
	}
	table.Columns = append(table.Columns, blockColumn)

	// 创建其他类型的列
	columnTypes := []KeyType{
		KeyTypeText,
		KeyTypeNumber,
		KeyTypeDate,
		KeyTypeSelect,
		KeyTypeRelation,
	}

	for i := 0; i < columnCount; i++ {
		colType := columnTypes[i%len(columnTypes)]
		column := &TableColumn{
			BaseInstanceField: &BaseInstanceField{
				ID:   ast.NewNodeID(),
				Name: fmt.Sprintf("Column_%d", i+1),
				Type: colType,
				Icon: "",
			},
		}

		// 为 Select 类型添加选项
		if colType == KeyTypeSelect {
			column.Options = []*SelectOption{
				{Name: "Option1", Color: "1"},
				{Name: "Option2", Color: "2"},
				{Name: "Option3", Color: "3"},
			}
		}

		table.Columns = append(table.Columns, column)
	}

	// 生成行数据
	for rowIdx := 0; rowIdx < rowCount; rowIdx++ {
		row := &TableRow{
			ID:    ast.NewNodeID(),
			Cells: []*TableCell{},
		}

		// 为每一列生成值
		for colIdx, column := range table.Columns {
			value := generateValueByType(column.Type, rowIdx, colIdx, column.ID, row.ID)
			cell := &TableCell{
				BaseValue: &BaseValue{
					ID:        ast.NewNodeID(),
					Value:     value,
					ValueType: column.Type,
				},
			}
			row.Cells = append(row.Cells, cell)
		}

		table.Rows = append(table.Rows, row)
	}

	return table
}

// generateValueByType 根据类型生成值
func generateValueByType(colType KeyType, rowIdx, colIdx int, keyID, blockID string) *Value {
	now := time.Now().UnixMilli()
	value := &Value{
		ID:        ast.NewNodeID(),
		KeyID:     keyID,
		BlockID:   blockID,
		Type:      colType,
		CreatedAt: now,
		UpdatedAt: now,
	}

	switch colType {
	case KeyTypeBlock:
		value.Block = &ValueBlock{
			ID:      blockID,
			Content: fmt.Sprintf("Block_%d", rowIdx),
			Created: now,
			Updated: now,
		}

	case KeyTypeText:
		value.Text = &ValueText{
			Content: fmt.Sprintf("Text_%d_%d", rowIdx, colIdx),
		}

	case KeyTypeNumber:
		value.Number = &ValueNumber{
			Content:          float64(rowIdx*100 + colIdx),
			IsNotEmpty:       true,
			Format:           NumberFormatNone,
			FormattedContent: fmt.Sprintf("%d", rowIdx*100+colIdx),
		}

	case KeyTypeDate:
		// 生成不同的日期值
		dateTime := time.Now().AddDate(0, 0, -rowIdx).UnixMilli()
		value.Date = &ValueDate{
			Content:          dateTime,
			IsNotEmpty:       true,
			HasEndDate:       false,
			IsNotTime:        false,
			FormattedContent: time.UnixMilli(dateTime).Format("2006-01-02 15:04"),
		}

	case KeyTypeSelect:
		options := []string{"Option1", "Option2", "Option3"}
		selectedOption := options[rowIdx%len(options)]
		value.MSelect = []*ValueSelect{
			{
				Content: selectedOption,
				Color:   fmt.Sprintf("%d", (rowIdx%3)+1),
			},
		}

	case KeyTypeRelation:
		// 生成关联值（简化版本）
		value.Relation = &ValueRelation{
			BlockIDs: []string{fmt.Sprintf("related_block_%d", rowIdx)},
			Contents: []*Value{
				{
					Type: KeyTypeBlock,
					Block: &ValueBlock{
						Content: fmt.Sprintf("Related_%d", rowIdx),
					},
				},
			},
		}

	case KeyTypeURL:
		value.URL = &ValueURL{
			Content: fmt.Sprintf("https://example.com/%d", rowIdx),
		}

	case KeyTypeEmail:
		value.Email = &ValueEmail{
			Content: fmt.Sprintf("user%d@example.com", rowIdx),
		}

	case KeyTypeCheckbox:
		value.Checkbox = &ValueCheckbox{
			Checked: rowIdx%2 == 0,
		}
	}

	return value
}

// generateFilters 生成过滤条件
func generateFilters(table *Table, filterCount int) []*ViewFilter {
	filters := []*ViewFilter{}

	if filterCount <= 0 || len(table.Columns) <= 1 {
		return filters
	}

	// 跳过主键列，从第二列开始生成过滤条件
	for i := 0; i < filterCount && i < len(table.Columns)-1; i++ {
		column := table.Columns[i+1] // 跳过主键列

		var filter *ViewFilter

		switch column.Type {
		case KeyTypeText:
			filter = &ViewFilter{
				Column:   column.ID,
				Operator: FilterOperatorContains,
				Value: &Value{
					Type: KeyTypeText,
					Text: &ValueText{Content: "Text_"},
				},
			}

		case KeyTypeNumber:
			filter = &ViewFilter{
				Column:   column.ID,
				Operator: FilterOperatorIsGreater,
				Value: &Value{
					Type: KeyTypeNumber,
					Number: &ValueNumber{
						Content:    50,
						IsNotEmpty: true,
					},
				},
			}

		case KeyTypeDate:
			filter = &ViewFilter{
				Column:   column.ID,
				Operator: FilterOperatorIsGreater,
				Value: &Value{
					Type: KeyTypeDate,
					Date: &ValueDate{
						Content:    time.Now().AddDate(0, 0, -30).UnixMilli(),
						IsNotEmpty: true,
					},
				},
			}

		case KeyTypeSelect:
			filter = &ViewFilter{
				Column:   column.ID,
				Operator: FilterOperatorIsEqual,
				Value: &Value{
					Type: KeyTypeSelect,
					MSelect: []*ValueSelect{
						{Content: "Option1", Color: "1"},
					},
				},
			}

		case KeyTypeRelation:
			filter = &ViewFilter{
				Column:   column.ID,
				Operator: FilterOperatorIsNotEmpty,
				Value: &Value{
					Type:     KeyTypeRelation,
					Relation: &ValueRelation{},
				},
			}
		}

		if filter != nil {
			filters = append(filters, filter)
		}
	}

	return filters
}

// BenchmarkFilter_BasicScenarios 测试基础过滤场景
func BenchmarkFilter_BasicScenarios(b *testing.B) {
	scenarios := []struct {
		name        string
		rowCount    int
		columnCount int
		filterCount int
	}{
		{"100rows_1filter", 100, 5, 1},
		{"100rows_3filters", 100, 5, 3},
		{"100rows_5filters", 100, 5, 5},
		{"500rows_1filter", 500, 5, 1},
		{"500rows_3filters", 500, 5, 3},
		{"500rows_5filters", 500, 5, 5},
		{"1000rows_1filter", 1000, 5, 1},
		{"1000rows_3filters", 1000, 5, 3},
		{"1000rows_5filters", 1000, 5, 5},
		{"5000rows_1filter", 5000, 5, 1},
		{"5000rows_3filters", 5000, 5, 3},
		{"5000rows_10filters", 5000, 10, 10},
	}

	for _, scenario := range scenarios {
		b.Run(scenario.name, func(b *testing.B) {
			// 生成测试数据
			table := generateBenchmarkData(scenario.rowCount, scenario.columnCount)
			filters := generateFilters(table, scenario.filterCount)
			table.Filters = filters

			// 创建 AttributeView（用于某些过滤操作）
			attrView := &AttributeView{
				ID:                ast.NewNodeID(),
				KeyValues:         []*KeyValues{},
				RenderedViewables: map[string]Viewable{},
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				// 每次测试前复制数据，避免修改原始数据
				testTable := &Table{
					BaseInstance: table.BaseInstance,
					Columns:      table.Columns,
					Rows:         make([]*TableRow, len(table.Rows)),
					RowCount:     table.RowCount,
				}
				copy(testTable.Rows, table.Rows)

				// 执行过滤
				Filter(testTable, attrView, nil, nil)
			}
		})
	}
}

// BenchmarkFilter_FieldTypes 测试不同字段类型的过滤性能
func BenchmarkFilter_FieldTypes(b *testing.B) {
	fieldTypes := []struct {
		name     string
		keyType  KeyType
		operator FilterOperator
	}{
		{"Text_Contains", KeyTypeText, FilterOperatorContains},
		{"Number_Greater", KeyTypeNumber, FilterOperatorIsGreater},
		{"Date_Greater", KeyTypeDate, FilterOperatorIsGreater},
		{"Select_Equal", KeyTypeSelect, FilterOperatorIsEqual},
		{"Checkbox_IsTrue", KeyTypeCheckbox, FilterOperatorIsTrue},
	}

	rowCount := 1000

	for _, ft := range fieldTypes {
		b.Run(ft.name, func(b *testing.B) {
			// 创建只包含特定类型字段的表格
			table := &Table{
				BaseInstance: &BaseInstance{
					ID:       ast.NewNodeID(),
					Filters:  []*ViewFilter{},
					Sorts:    []*ViewSort{},
					PageSize: 50,
				},
				Columns:  []*TableColumn{},
				Rows:     []*TableRow{},
				RowCount: rowCount,
			}

			// 添加主键列
			blockColumn := &TableColumn{
				BaseInstanceField: &BaseInstanceField{
					ID:   ast.NewNodeID(),
					Name: "Block",
					Type: KeyTypeBlock,
				},
			}
			table.Columns = append(table.Columns, blockColumn)

			// 添加测试字段列
			testColumn := &TableColumn{
				BaseInstanceField: &BaseInstanceField{
					ID:   ast.NewNodeID(),
					Name: "TestField",
					Type: ft.keyType,
				},
			}
			if ft.keyType == KeyTypeSelect {
				testColumn.Options = []*SelectOption{
					{Name: "Option1", Color: "1"},
					{Name: "Option2", Color: "2"},
				}
			}
			table.Columns = append(table.Columns, testColumn)

			// 生成行数据
			for rowIdx := 0; rowIdx < rowCount; rowIdx++ {
				row := &TableRow{
					ID:    ast.NewNodeID(),
					Cells: []*TableCell{},
				}

				// 主键单元格
				blockValue := generateValueByType(KeyTypeBlock, rowIdx, 0, blockColumn.ID, row.ID)
				row.Cells = append(row.Cells, &TableCell{
					BaseValue: &BaseValue{
						ID:        ast.NewNodeID(),
						Value:     blockValue,
						ValueType: KeyTypeBlock,
					},
				})

				// 测试字段单元格
				testValue := generateValueByType(ft.keyType, rowIdx, 1, testColumn.ID, row.ID)
				row.Cells = append(row.Cells, &TableCell{
					BaseValue: &BaseValue{
						ID:        ast.NewNodeID(),
						Value:     testValue,
						ValueType: ft.keyType,
					},
				})

				table.Rows = append(table.Rows, row)
			}

			// 创建过滤条件
			var filterValue *Value
			switch ft.keyType {
			case KeyTypeText:
				filterValue = &Value{
					Type: KeyTypeText,
					Text: &ValueText{Content: "Text_"},
				}
			case KeyTypeNumber:
				filterValue = &Value{
					Type: KeyTypeNumber,
					Number: &ValueNumber{
						Content:    500,
						IsNotEmpty: true,
					},
				}
			case KeyTypeDate:
				filterValue = &Value{
					Type: KeyTypeDate,
					Date: &ValueDate{
						Content:    time.Now().AddDate(0, 0, -500).UnixMilli(),
						IsNotEmpty: true,
					},
				}
			case KeyTypeSelect:
				filterValue = &Value{
					Type: KeyTypeSelect,
					MSelect: []*ValueSelect{
						{Content: "Option1", Color: "1"},
					},
				}
			case KeyTypeCheckbox:
				filterValue = &Value{
					Type:     KeyTypeCheckbox,
					Checkbox: &ValueCheckbox{Checked: true},
				}
			}

			table.Filters = []*ViewFilter{
				{
					Column:   testColumn.ID,
					Operator: ft.operator,
					Value:    filterValue,
				},
			}

			attrView := &AttributeView{
				ID:                ast.NewNodeID(),
				KeyValues:         []*KeyValues{},
				RenderedViewables: map[string]Viewable{},
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				testTable := &Table{
					BaseInstance: table.BaseInstance,
					Columns:      table.Columns,
					Rows:         make([]*TableRow, len(table.Rows)),
					RowCount:     table.RowCount,
				}
				copy(testTable.Rows, table.Rows)

				Filter(testTable, attrView, nil, nil)
			}
		})
	}
}

// BenchmarkFilter_ColumnCount 测试列数对性能的影响
func BenchmarkFilter_ColumnCount(b *testing.B) {
	columnCounts := []int{5, 10, 20, 50}
	rowCount := 1000
	filterCount := 3

	for _, colCount := range columnCounts {
		b.Run(fmt.Sprintf("%dcolumns", colCount), func(b *testing.B) {
			table := generateBenchmarkData(rowCount, colCount)
			filters := generateFilters(table, filterCount)
			table.Filters = filters

			attrView := &AttributeView{
				ID:                ast.NewNodeID(),
				KeyValues:         []*KeyValues{},
				RenderedViewables: map[string]Viewable{},
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				testTable := &Table{
					BaseInstance: table.BaseInstance,
					Columns:      table.Columns,
					Rows:         make([]*TableRow, len(table.Rows)),
					RowCount:     table.RowCount,
				}
				copy(testTable.Rows, table.Rows)

				Filter(testTable, attrView, nil, nil)
			}
		})
	}
}

// TestFilterPerformanceRegression 性能问题验证测试
func TestFilterPerformanceRegression(t *testing.T) {
	if testing.Short() {
		t.Skip("performance regression test")
	}
	t.Run("VerifyComplexity", func(t *testing.T) {
		// 验证 O(n×m) 复杂度问题
		// 测试不同数据规模下的性能差异

		testCases := []struct {
			rows    int
			columns int
			filters int
		}{
			{100, 5, 3},
			{200, 5, 3},
			{400, 5, 3},
		}

		var durations []time.Duration

		for _, tc := range testCases {
			table := generateBenchmarkData(tc.rows, tc.columns)
			filters := generateFilters(table, tc.filters)
			table.Filters = filters

			attrView := &AttributeView{
				ID:                ast.NewNodeID(),
				KeyValues:         []*KeyValues{},
				RenderedViewables: map[string]Viewable{},
			}

			start := time.Now()
			iterations := 100
			for i := 0; i < iterations; i++ {
				testTable := &Table{
					BaseInstance: table.BaseInstance,
					Columns:      table.Columns,
					Rows:         make([]*TableRow, len(table.Rows)),
					RowCount:     table.RowCount,
				}
				copy(testTable.Rows, table.Rows)
				Filter(testTable, attrView, nil, nil)
			}
			duration := time.Since(start)
			durations = append(durations, duration)

			t.Logf("Rows: %d, Columns: %d, Filters: %d, Duration: %v, Avg: %v",
				tc.rows, tc.columns, tc.filters, duration, duration/time.Duration(iterations))
		}

		// 验证时间复杂度：当行数翻倍时，时间应该大致翻倍（O(n)关系）
		if len(durations) >= 2 {
			ratio1 := float64(durations[1]) / float64(durations[0])
			ratio2 := float64(durations[2]) / float64(durations[1])
			t.Logf("Time ratio (200/100): %.2f, (400/200): %.2f", ratio1, ratio2)

			// 如果比率远大于2，说明存在性能问题
			if ratio1 > 3.0 || ratio2 > 3.0 {
				t.Logf("WARNING: Performance may not scale linearly with row count")
			}
		}
	})

	t.Run("VerifyColumnLookup", func(t *testing.T) {
		// 验证字段索引查找问题
		// 测试列数对性能的影响

		rowCount := 1000
		filterCount := 5

		testCases := []struct {
			columns int
		}{
			{5},
			{10},
			{20},
			{50},
		}

		var durations []time.Duration

		for _, tc := range testCases {
			table := generateBenchmarkData(rowCount, tc.columns)
			filters := generateFilters(table, filterCount)
			table.Filters = filters

			attrView := &AttributeView{
				ID:                ast.NewNodeID(),
				KeyValues:         []*KeyValues{},
				RenderedViewables: map[string]Viewable{},
			}

			start := time.Now()
			iterations := 50
			for i := 0; i < iterations; i++ {
				testTable := &Table{
					BaseInstance: table.BaseInstance,
					Columns:      table.Columns,
					Rows:         make([]*TableRow, len(table.Rows)),
					RowCount:     table.RowCount,
				}
				copy(testTable.Rows, table.Rows)
				Filter(testTable, attrView, nil, nil)
			}
			duration := time.Since(start)
			durations = append(durations, duration)

			t.Logf("Columns: %d, Duration: %v, Avg: %v",
				tc.columns, duration, duration/time.Duration(iterations))
		}

		// 验证列数对性能的影响
		// 理想情况下，列数增加不应该显著影响过滤性能（如果有索引）
		if len(durations) >= 2 {
			ratio := float64(durations[len(durations)-1]) / float64(durations[0])
			t.Logf("Time ratio (50cols/5cols): %.2f", ratio)

			// 如果列数增加10倍，时间增加超过3倍，说明可能存在线性查找问题
			if ratio > 3.0 {
				t.Logf("WARNING: Column lookup may not be optimized (possible O(m) lookup)")
			}
		}
	})

	t.Run("VerifyRollupPerformance", func(t *testing.T) {
		// 验证汇总字段性能问题
		// 这个测试比较简化，因为完整的汇总测试需要更复杂的数据结构

		rowCount := 500
		columnCount := 5

		table := generateBenchmarkData(rowCount, columnCount)

		// 创建一个简单的过滤条件
		if len(table.Columns) > 1 {
			table.Filters = []*ViewFilter{
				{
					Column:   table.Columns[1].ID,
					Operator: FilterOperatorIsNotEmpty,
					Value: &Value{
						Type: table.Columns[1].Type,
					},
				},
			}
		}

		attrView := &AttributeView{
			ID:                ast.NewNodeID(),
			KeyValues:         []*KeyValues{},
			RenderedViewables: map[string]Viewable{},
		}

		start := time.Now()
		iterations := 100
		for i := 0; i < iterations; i++ {
			testTable := &Table{
				BaseInstance: table.BaseInstance,
				Columns:      table.Columns,
				Rows:         make([]*TableRow, len(table.Rows)),
				RowCount:     table.RowCount,
			}
			copy(testTable.Rows, table.Rows)
			Filter(testTable, attrView, nil, nil)
		}
		duration := time.Since(start)

		avgDuration := duration / time.Duration(iterations)
		t.Logf("Rows: %d, Duration: %v, Avg: %v", rowCount, duration, avgDuration)

		// 基准：500行数据的平均过滤时间应该在合理范围内
		// 这里设置一个警告阈值（可根据实际情况调整）
		if avgDuration > 10*time.Millisecond {
			t.Logf("WARNING: Average filter time (%v) exceeds 10ms for 500 rows", avgDuration)
		}
	})
}

// BenchmarkFilter_Memory 测试内存使用情况
func BenchmarkFilter_Memory(b *testing.B) {
	scenarios := []struct {
		name        string
		rowCount    int
		columnCount int
		filterCount int
	}{
		{"small_100x5", 100, 5, 3},
		{"medium_1000x10", 1000, 10, 5},
		{"large_5000x20", 5000, 20, 10},
	}

	for _, scenario := range scenarios {
		b.Run(scenario.name, func(b *testing.B) {
			table := generateBenchmarkData(scenario.rowCount, scenario.columnCount)
			filters := generateFilters(table, scenario.filterCount)
			table.Filters = filters

			attrView := &AttributeView{
				ID:                ast.NewNodeID(),
				KeyValues:         []*KeyValues{},
				RenderedViewables: map[string]Viewable{},
			}

			b.ReportAllocs()
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				testTable := &Table{
					BaseInstance: table.BaseInstance,
					Columns:      table.Columns,
					Rows:         make([]*TableRow, len(table.Rows)),
					RowCount:     table.RowCount,
				}
				copy(testTable.Rows, table.Rows)

				Filter(testTable, attrView, nil, nil)
			}
		})
	}
}
