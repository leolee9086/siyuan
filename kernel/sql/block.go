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

package sql

import (
	"bytes"
	"database/sql"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/88250/lute/ast"
	"github.com/88250/lute/editor"
	"github.com/88250/lute/html"
	"github.com/88250/lute/parse"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/av"
	"github.com/siyuan-note/siyuan/kernel/cache"
	"github.com/siyuan-note/siyuan/kernel/filesys"
	"github.com/siyuan-note/siyuan/kernel/treenode"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// ftsRowidPair 记录一个 block 在两张 FTS 表中的 rowid。
// rowid 在 INSERT 时由 SQLite 自动分配，后续 UPDATE 用 rowid 可避免全表扫描（WHERE id = ? 在 FTS5 中无索引）。
type ftsRowidPair struct {
	rowid   int64 // blocks_fts.rowid
	rowidCI int64 // blocks_fts_case_insensitive.rowid，0 表示无双表
}

var (
	blockFTSRowIDs     map[string]*ftsRowidPair
	blockFTSRowIDsLock sync.RWMutex
)

func init() {
	clearFTSRowIDs()
}

func storeFTSRowIDs(blockIDs []string, ftsFirst, ciFirst int64) {
	blockFTSRowIDsLock.Lock()
	defer blockFTSRowIDsLock.Unlock()
	for i, id := range blockIDs {
		blockFTSRowIDs[id] = &ftsRowidPair{
			rowid:   ftsFirst + int64(i),
			rowidCI: ciFirst + int64(i),
		}
	}
}

func getFTSRowIDs(blockID string) (pair *ftsRowidPair, ok bool) {
	blockFTSRowIDsLock.RLock()
	defer blockFTSRowIDsLock.RUnlock()
	pair, ok = blockFTSRowIDs[blockID]
	return
}

func clearFTSRowIDs() {
	blockFTSRowIDsLock.Lock()
	defer blockFTSRowIDsLock.Unlock()
	blockFTSRowIDs = make(map[string]*ftsRowidPair)
}

// storeFTSRowIDMap 批量存储预填充的 rowid 映射，不依赖 rowid 连续性。
func storeFTSRowIDMap(entries map[string]*ftsRowidPair) {
	blockFTSRowIDsLock.Lock()
	defer blockFTSRowIDsLock.Unlock()
	for id, pair := range entries {
		blockFTSRowIDs[id] = pair
	}
}

// buildFTSRowIDMapping 扫描 blocks_fts 和 blocks_fts_case_insensitive 为所有存量 block 构建 rowid 映射。
// 确保部署后存量 block 的第一次 UPDATE 不会退化到全表扫描。
func buildFTSRowIDMapping() {
	entries := map[string]*ftsRowidPair{}

	rows, err := db.Query("SELECT rowid, id FROM blocks_fts")
	if err != nil {
		logging.LogErrorf("build FTS rowid mapping failed: %s", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var rowid int64
		var id string
		if err := rows.Scan(&rowid, &id); err != nil {
			continue
		}
		entries[id] = &ftsRowidPair{rowid: rowid}
	}

	if !caseSensitive {
		rows2, err := db.Query("SELECT rowid, id FROM blocks_fts_case_insensitive")
		if err == nil {
			defer rows2.Close()
			for rows2.Next() {
				var rowid int64
				var id string
				if err := rows2.Scan(&rowid, &id); err != nil {
					continue
				}
				if p := entries[id]; p != nil {
					p.rowidCI = rowid
				} else {
					entries[id] = &ftsRowidPair{rowidCI: rowid}
				}
			}
		}
	}

	storeFTSRowIDMap(entries)
	logging.LogInfof("built FTS rowid mapping for [%d] blocks", len(entries))
}

type Block struct {
	ID       string
	ParentID string
	RootID   string
	Hash     string
	Box      string
	Path     string
	HPath    string
	Name     string
	Alias    string
	Memo     string
	Tag      string
	Content  string
	FContent string
	Markdown string
	Length   int
	Type     string
	SubType  string
	IAL      string
	Sort     int
	Created  string
	Updated  string
}

func updateRootContent(tx *sql.Tx, content, updated, ialContent, id string) (err error) {
	stmt := "UPDATE blocks SET content = ?, fcontent = ?, updated = ? WHERE id = ?"
	if err = execStmtTx(tx, stmt, content, content, updated, id); err != nil {
		return
	}

	if pair, ok := getFTSRowIDs(id); ok {
		stmt = "UPDATE blocks_fts SET content = ?, fcontent = ?, updated = ?, ial = ? WHERE rowid = ?"
		if err = execStmtTx(tx, stmt, content, content, updated, ialContent, pair.rowid); err != nil {
			return
		}
		if pair.rowidCI > 0 {
			stmt = "UPDATE blocks_fts_case_insensitive SET content = ?, fcontent = ?, updated = ?, ial = ? WHERE rowid = ?"
			if err = execStmtTx(tx, stmt, content, content, updated, ialContent, pair.rowidCI); err != nil {
				return
			}
		}
	} else {
		stmt = "UPDATE blocks_fts SET content = ?, fcontent = ?, updated = ?, ial = ? WHERE id = ?"
		if err = execStmtTx(tx, stmt, content, content, updated, ialContent, id); err != nil {
			return
		}
		if !caseSensitive {
			stmt = "UPDATE blocks_fts_case_insensitive SET content = ?, fcontent = ?, updated = ?, ial = ? WHERE id = ?"
			if err = execStmtTx(tx, stmt, content, content, updated, ialContent, id); err != nil {
				return
			}
		}
	}

	removeBlockCache(id)
	cache.RemoveBlockIAL(id)
	return
}

func updateBlockContent(tx *sql.Tx, block *Block) (err error) {
	t0 := time.Now()

	stmt := "UPDATE blocks SET content = ? WHERE id = ?"
	if err = execStmtTx(tx, stmt, block.Content, block.ID); err != nil {
		tx.Rollback()
		return
	}
	t1 := time.Now()

	// FTS 表改用 rowid 更新（O(1)），避免 WHERE id = ? 全表扫描
	if pair, ok := getFTSRowIDs(block.ID); ok {
		stmt = "UPDATE blocks_fts SET content = ? WHERE rowid = ?"
		if err = execStmtTx(tx, stmt, block.Content, pair.rowid); err != nil {
			tx.Rollback()
			return
		}
		if pair.rowidCI > 0 {
			stmt = "UPDATE blocks_fts_case_insensitive SET content = ? WHERE rowid = ?"
			if err = execStmtTx(tx, stmt, block.Content, pair.rowidCI); err != nil {
				tx.Rollback()
				return
			}
		}
	} else {
		// fallback: 映射不存在时退化到 WHERE id = ?
		stmt = "UPDATE blocks_fts SET content = ? WHERE id = ?"
		if err = execStmtTx(tx, stmt, block.Content, block.ID); err != nil {
			tx.Rollback()
			return
		}
		if !caseSensitive {
			stmt = "UPDATE blocks_fts_case_insensitive SET content = ? WHERE id = ?"
			if err = execStmtTx(tx, stmt, block.Content, block.ID); err != nil {
				tx.Rollback()
				return
			}
		}
	}
	t2 := time.Now()

	putBlockCache(block)
	t3 := time.Now()

	elapsed := t3.Sub(t0)
	if 500 < elapsed.Milliseconds() {
		logging.LogWarnf("slow update_block_content [id=%s] content_len=%d took [%dms]: blocks=%d fts=%d cache=%d",
			block.ID, len(block.Content), elapsed.Milliseconds(),
			t1.Sub(t0).Milliseconds(), t2.Sub(t1).Milliseconds(), t3.Sub(t2).Milliseconds())
	}
	return
}

func indexNode(tx *sql.Tx, id string) (err error) {
	bt := treenode.GetBlockTree(id)
	if nil == bt {
		return
	}

	tree, _ := filesys.LoadTree(bt.BoxID, bt.Path, luteEngine)
	if nil == tree {
		return
	}

	node := treenode.GetNodeInTree(tree, id)
	if nil == node {
		return
	}

	content := NodeStaticContent(node, nil, true, indexAssetPath, true)
	content = strings.ReplaceAll(content, editor.Zwsp, "")
	stmt := "UPDATE blocks SET content = ? WHERE id = ?"
	if err = execStmtTx(tx, stmt, content, id); err != nil {
		tx.Rollback()
		return
	}

	if pair, ok := getFTSRowIDs(id); ok {
		stmt = "UPDATE blocks_fts SET content = ? WHERE rowid = ?"
		if err = execStmtTx(tx, stmt, content, pair.rowid); err != nil {
			tx.Rollback()
			return
		}
		if pair.rowidCI > 0 {
			stmt = "UPDATE blocks_fts_case_insensitive SET content = ? WHERE rowid = ?"
			if err = execStmtTx(tx, stmt, content, pair.rowidCI); err != nil {
				tx.Rollback()
				return
			}
		}
	} else {
		stmt = "UPDATE blocks_fts SET content = ? WHERE id = ?"
		if err = execStmtTx(tx, stmt, content, id); err != nil {
			tx.Rollback()
			return
		}
		if !caseSensitive {
			stmt = "UPDATE blocks_fts_case_insensitive SET content = ? WHERE id = ?"
			if err = execStmtTx(tx, stmt, content, id); err != nil {
				tx.Rollback()
				return
			}
		}
	}
	return
}

func NodeStaticContent(node *ast.Node, excludeTypes []string, includeTextMarkATitleURL, includeAssetPath, fullAttrView bool) string {
	if nil == node {
		return ""
	}

	if ast.NodeDocument == node.Type {
		return html.EscapeHTMLStr(node.IALAttr("title"))
	}

	if ast.NodeAttributeView == node.Type {
		if fullAttrView {
			return av.GetAttributeViewContent(node.AttributeViewID)
		}

		ret, _ := av.GetAttributeViewName(node.AttributeViewID)
		return html.EscapeHTMLStr(ret)
	}

	buf := bytes.Buffer{}
	buf.Grow(4096)
	lastSpace := false
	ast.Walk(node, func(n *ast.Node, entering bool) ast.WalkStatus {
		if !entering {
			if ast.NodeTable == n.Type {
				caption := n.IALAttr("caption")
				if "" != caption {
					caption = html.UnescapeHTMLStr(caption)
					if strings.Contains(caption, "caption-side:") && strings.Contains(caption, "bottom") {
						caption = gulu.Str.SubStringBetween(caption, ">", "<")
						buf.WriteByte(' ')
						buf.WriteString(caption)
					}
				}
			}
			return ast.WalkContinue
		}

		if n.IsContainerBlock() {
			if !lastSpace {
				buf.WriteByte(' ')
				lastSpace = true
			}
			if ast.NodeCallout == n.Type {
				buf.WriteString(n.CalloutType + " ")
				if "" != n.CalloutIcon && 0 == n.CalloutIconType {
					buf.WriteString(n.CalloutIcon + " ")
				}
				if "" != n.CalloutTitle {
					if titleTree := parse.Inline("", []byte(n.CalloutTitle), luteEngine.ParseOptions); nil != titleTree && nil != titleTree.Root.FirstChild.FirstChild {
						var inlines []*ast.Node
						for c := titleTree.Root.FirstChild.FirstChild; nil != c; c = c.Next {
							inlines = append(inlines, c)
						}
						for _, inline := range inlines {
							buf.WriteString(inline.Content())
						}
					}
					buf.WriteByte(' ')
				}
			}
			return ast.WalkContinue
		}

		if gulu.Str.Contains(n.Type.String(), excludeTypes) {
			return ast.WalkContinue
		}

		switch n.Type {
		case ast.NodeTable:
			caption := n.IALAttr("caption")
			if "" != caption {
				caption = html.UnescapeHTMLStr(caption)
				if strings.Contains(caption, "caption-side:") && strings.Contains(caption, "bottom") {
					return ast.WalkContinue
				}
				caption = gulu.Str.SubStringBetween(caption, ">", "<")
				buf.WriteString(caption)
				buf.WriteByte(' ')
			}
		case ast.NodeTableCell:
			// 表格块写入数据库表时在单元格之间添加空格 https://github.com/siyuan-note/siyuan/issues/7654
			if 0 < buf.Len() && ' ' != buf.Bytes()[buf.Len()-1] {
				buf.WriteByte(' ')
			}
		case ast.NodeImage:
			linkDest := n.ChildByType(ast.NodeLinkDest)
			var linkDestStr, ocrText string
			if nil != linkDest {
				linkDestStr = linkDest.TokensStr()
				ocrText = util.GetAssetText(linkDestStr)
			}

			linkText := n.ChildByType(ast.NodeLinkText)
			if nil != linkText {
				buf.Write(linkText.Tokens)
				buf.WriteByte(' ')
			}
			if "" != ocrText {
				buf.WriteString(ocrText)
				buf.WriteByte(' ')
			}
			if nil != linkDest {
				if !bytes.HasPrefix(linkDest.Tokens, []byte("assets/")) || includeAssetPath {
					buf.Write(linkDest.Tokens)
					buf.WriteByte(' ')
				}
			}
			if linkTitle := n.ChildByType(ast.NodeLinkTitle); nil != linkTitle {
				buf.Write(linkTitle.Tokens)
			}
			return ast.WalkSkipChildren
		case ast.NodeLinkText:
			buf.Write(n.Tokens)
			buf.WriteByte(' ')
		case ast.NodeLinkDest:
			buf.Write(n.Tokens)
			buf.WriteByte(' ')
		case ast.NodeLinkTitle:
			buf.Write(n.Tokens)
		case ast.NodeText, ast.NodeCodeBlockCode, ast.NodeMathBlockContent, ast.NodeHTMLBlock:
			tokens := n.Tokens
			if treenode.IsChartCodeBlockCode(n) {
				// 图表块的内容在数据库 `blocks` 表 `content` 字段中被转义 https://github.com/siyuan-note/siyuan/issues/6326
				tokens = html.UnescapeHTML(tokens)
			}
			buf.Write(tokens)
		case ast.NodeTextMark:
			for _, excludeType := range excludeTypes {
				if strings.HasPrefix(excludeType, "NodeTextMark-") {
					if n.IsTextMarkType(excludeType[len("NodeTextMark-"):]) {
						return ast.WalkContinue
					}
				}
			}

			if n.IsTextMarkType("tag") {
				buf.WriteByte('#')
			}
			buf.WriteString(n.Content())
			if n.IsTextMarkType("tag") {
				buf.WriteByte('#')
			}
			if n.IsTextMarkType("a") && includeTextMarkATitleURL {
				// 搜索不到超链接元素的 URL 和标题 https://github.com/siyuan-note/siyuan/issues/7352
				if "" != n.TextMarkATitle {
					buf.WriteString(" " + util.UnescapeHTML(n.TextMarkATitle))
				}

				if !strings.HasPrefix(n.TextMarkAHref, "assets/") || includeAssetPath {
					href := util.UnescapeHTML(n.TextMarkAHref)
					buf.WriteString(" " + util.UnescapeHTML(href))
				}
			}
		case ast.NodeBackslashContent:
			buf.Write(n.Tokens)
		case ast.NodeAudio, ast.NodeVideo:
			buf.WriteString(treenode.GetNodeSrcTokens(n))
			buf.WriteByte(' ')
		}
		lastSpace = false
		return ast.WalkContinue
	})

	// 这里不要 trim，否则无法搜索首尾空格
	// Improve search and replace for spaces https://github.com/siyuan-note/siyuan/issues/10231
	return buf.String()
}

func BatchGetBlockAttrsWitTrees(ids []string, trees map[string]*parse.Tree) (ret map[string]map[string]string) {
	ret = map[string]map[string]string{}

	hitCache := true
	for _, id := range ids {
		ial := cache.GetBlockIAL(id)
		if nil != ial {
			ret[id] = ial
			continue
		}
		hitCache = false
		break
	}
	if hitCache {
		return
	}

	for _, id := range ids {
		tree := trees[id]
		if nil == tree {
			continue
		}

		ret[id] = getBlockAttrsFromTree(id, tree)
	}
	return
}

func BatchGetBlockAttrs(ids []string) (ret map[string]map[string]string) {
	ret = map[string]map[string]string{}

	hitCache := true
	for _, id := range ids {
		ial := cache.GetBlockIAL(id)
		if nil != ial {
			ret[id] = ial
			continue
		}
		hitCache = false
		break
	}
	if hitCache {
		return
	}

	trees := filesys.LoadTrees(ids)
	for _, id := range ids {
		tree := trees[id]
		if nil == tree {
			continue
		}

		ret[id] = getBlockAttrsFromTree(id, tree)
	}
	return
}

func GetBlockAttrs(id string) (ret map[string]string) {
	ret = map[string]string{}
	if cached := cache.GetBlockIAL(id); nil != cached {
		ret = cached
		return
	}

	tree := loadTreeByBlockID(id)
	if nil == tree {
		return
	}

	ret = getBlockAttrsFromTree(id, tree)
	return
}

func getBlockAttrsFromTree(id string, tree *parse.Tree) (ret map[string]string) {
	ret = map[string]string{}

	ial := cache.GetBlockIAL(id)
	if nil != ial {
		for k, v := range ial {
			ret[k] = v
		}
		return
	}

	node := treenode.GetNodeInTree(tree, id)
	if nil == node {
		logging.LogWarnf("block [%s] not found", id)
		return
	}

	for _, kv := range node.KramdownIAL {
		ret[kv[0]] = html.UnescapeAttrVal(kv[1])
	}
	cache.PutBlockIAL(id, ret)
	return
}

func loadTreeByBlockID(id string) (ret *parse.Tree) {
	bt := treenode.GetBlockTree(id)
	if nil == bt {
		return
	}

	ret, err := filesys.LoadTree(bt.BoxID, bt.Path, luteEngine)
	if nil != err {
		return
	}
	return
}
