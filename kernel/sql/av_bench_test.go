package sql

import (
	"fmt"
	"testing"
	"time"

	"github.com/88250/lute/ast"
	"github.com/siyuan-note/siyuan/kernel/av"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func init() {
	util.Lang = "zh_CN"
	util.AttrViewLangs = map[string]map[string]interface{}{
		"zh_CN": {
			"table":  "Table",
			"key":    "Key",
			"select": "Select",
		},
	}
}

// generateBenchmarkAttributeView 生成基准测试用的 AttributeView
// mode: 0-plain text, 1-with template
func generateBenchmarkAttributeView(rowCount, columnCount int, mode int) (*av.AttributeView, *av.View) {
	attrView := av.NewAttributeView(ast.NewNodeID())
	view, _, _ := av.NewTableViewWithBlockKey(ast.NewNodeID())
	attrView.Views = append(attrView.Views, view)

	// 清理默认生成的 KeyValues (NewAttributeView 会生成默认的 Block 和 Select Key)
	attrView.KeyValues = []*av.KeyValues{}

	// 主键列
	blockKey := av.NewKey(ast.NewNodeID(), "Block", "", av.KeyTypeBlock)
	blockKV := &av.KeyValues{Key: blockKey, Values: []*av.Value{}}
	attrView.KeyValues = append(attrView.KeyValues, blockKV)

	// 重置视图列，第一列为主键
	view.Table.Columns = []*av.ViewTableColumn{
		{
			BaseField: &av.BaseField{
				ID: blockKey.ID,
			},
		},
	}

	// 其他列
	var otherKVs []*av.KeyValues
	for i := 0; i < columnCount; i++ {
		var key *av.Key
		if mode == 1 && i == 0 {
			// 模式1：第一列为模板列
			key = av.NewKey(ast.NewNodeID(), "Template_Col", "", av.KeyTypeTemplate)
			// 一个简单的模板，输出 ID
			key.Template = ".action{.id} - .action{.updated}"
		} else {
			key = av.NewKey(ast.NewNodeID(), fmt.Sprintf("Col_%d", i), "", av.KeyTypeText)
		}

		kv := &av.KeyValues{Key: key, Values: []*av.Value{}}
		otherKVs = append(otherKVs, kv)
		attrView.KeyValues = append(attrView.KeyValues, kv)

		col := &av.ViewTableColumn{
			BaseField: &av.BaseField{
				ID: key.ID,
			},
		}

		view.Table.Columns = append(view.Table.Columns, col)
	}

	// 生成数据
	for i := 0; i < rowCount; i++ {
		blockID := ast.NewNodeID()

		// 主键值 (IsDetached=true 避免 BatchGetBlockAttrs 访问磁盘)
		blockVal := &av.Value{
			ID:         ast.NewNodeID(),
			KeyID:      blockKey.ID,
			BlockID:    blockID,
			Type:       av.KeyTypeBlock,
			Block:      &av.ValueBlock{ID: blockID, Content: fmt.Sprintf("Row %d", i), Updated: time.Now().UnixMilli()},
			IsDetached: true,
		}
		blockKV.Values = append(blockKV.Values, blockVal)

		// 其他列值
		for j := 0; j < columnCount; j++ {
			kv := otherKVs[j]
			var val *av.Value

			if kv.Key.Type == av.KeyTypeTemplate {
				// 模板列的值在初始时通常为空，或者是之前的渲染结果。
				// 这里模拟为空，等待渲染。
				val = &av.Value{
					ID:       ast.NewNodeID(),
					KeyID:    kv.Key.ID,
					BlockID:  blockID,
					Type:     av.KeyTypeTemplate,
					Template: &av.ValueTemplate{Content: ""},
				}
			} else {
				val = &av.Value{
					ID:      ast.NewNodeID(),
					KeyID:   kv.Key.ID,
					BlockID: blockID,
					Type:    av.KeyTypeText,
					Text:    &av.ValueText{Content: fmt.Sprintf("Val %d-%d", i, j)},
				}
			}
			kv.Values = append(kv.Values, val)
		}
	}
	return attrView, view
}

func BenchmarkRenderAttributeViewTable_PlainText(b *testing.B) {
	scenarios := []struct {
		name        string
		rowCount    int
		columnCount int
	}{
		{"100rows_5cols", 100, 5},
		{"1000rows_5cols", 1000, 5},
	}

	for _, s := range scenarios {
		b.Run(s.name, func(b *testing.B) {
			attrView, view := generateBenchmarkAttributeView(s.rowCount, s.columnCount, 0)
			depth := 1

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				attrView.RenderedViewables = map[string]av.Viewable{}
				cachedAttrViews := map[string]*av.AttributeView{}
				RenderAttributeViewTable(attrView, view, "", &depth, cachedAttrViews, false)
			}
		})
	}
}

func BenchmarkRenderAttributeViewTable_WithTemplate(b *testing.B) {
	scenarios := []struct {
		name        string
		rowCount    int
		columnCount int
	}{
		{"100rows_1tpl_4text", 100, 5},
		{"1000rows_1tpl_4text", 1000, 5},
		{"5000rows_1tpl_4text", 5000, 5},
	}

	for _, s := range scenarios {
		b.Run(s.name, func(b *testing.B) {
			// mode 1: 包含一个模板列
			attrView, view := generateBenchmarkAttributeView(s.rowCount, s.columnCount, 1)
			depth := 1

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				// 清空缓存
				attrView.RenderedViewables = map[string]av.Viewable{}
				cachedAttrViews := map[string]*av.AttributeView{}

				RenderAttributeViewTable(attrView, view, "", &depth, cachedAttrViews, false)
			}
		})
	}
}

func TestRenderAttributeViewTable_Performance(t *testing.T) {
	if testing.Short() {
		t.Skip("performance test")
	}
	// 验证模板列性能
	rowCount := 1000
	colCount := 5
	attrView, view := generateBenchmarkAttributeView(rowCount, colCount, 1)
	depth := 1
	cachedAttrViews := map[string]*av.AttributeView{}

	start := time.Now()
	RenderAttributeViewTable(attrView, view, "", &depth, cachedAttrViews, false)
	elapsed := time.Since(start)

	t.Logf("RenderAttributeViewTable (With Template) %d rows x %d cols took %v", rowCount, colCount, elapsed)

	// 模板列通常比纯文本慢很多，这里设置一个宽松一点的阈值来观察
	if elapsed > 500*time.Millisecond {
		t.Logf("Performance Warning: Template Rendering took longer than 500ms")
	}
}
