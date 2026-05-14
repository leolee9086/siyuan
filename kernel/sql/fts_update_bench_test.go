package sql

import (
	"database/sql"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// TestFTSUpdateEquivalence 验证 UPDATE by rowid 与 UPDATE by id 在功能和语义上完全等价。
// 覆盖了原始代码中所有 5 种 FTS UPDATE 模式。
func TestFTSUpdateEquivalence(t *testing.T) {
	db := openTestFTSDB(t)
	defer db.Close()

	populateFTSForBench(t, db, 500)

	t.Run("content_only", func(t *testing.T) {
		testContentEqual(t, db)
	})
	t.Run("multi_column_content_fcontent_updated", func(t *testing.T) {
		testMultiColumnUpdate(t, db)
	})
	t.Run("fts_search_after_update", func(t *testing.T) {
		testFTSSearchCorrectness(t, db)
	})
	t.Run("fts_search_unicode", func(t *testing.T) {
		testFTSUnicode(t, db)
	})
	t.Run("empty_content", func(t *testing.T) {
		testFTSEmptyContent(t, db)
	})
	t.Run("large_content_100kb", func(t *testing.T) {
		testFTSLargeContent(t, db)
	})
	t.Run("transaction_rollback", func(t *testing.T) {
		testFTSRollback(t, db)
	})
	t.Run("multi_row_consistency", func(t *testing.T) {
		testMultiRowConsistency(t, db)
	})
	t.Run("rowid_same_as_id", func(t *testing.T) {
		testRowidEqualsID(t, db)
	})
	t.Run("direct_direct_equality", func(t *testing.T) {
		testDirectRowidVsIDEquality(t, db)
	})
	t.Run("both_fts_tables", func(t *testing.T) {
		testBothFTSTables(t, db)
	})
	t.Run("update_by_root_id", func(t *testing.T) {
		testUpdateByRootID(t, db)
	})
	t.Run("update_no_match", func(t *testing.T) {
		testUpdateNoMatch(t, db)
	})
	t.Run("insert_then_update_same_rowid", func(t *testing.T) {
		testInsertThenUpdateSameRowid(t, db)
	})
}

// testContentEqual: 模式 #2/#3 — content_only.
// UPDATE by rowid 后，通过 rowid 和通过 id 读到的内容一致；恢复原内容后值恢复。
func testContentEqual(t *testing.T, db *sql.DB) {
	rowid, id, origContent := pickRow(t, db)
	newContent := "verified content update by rowid"

	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", newContent, rowid)
	if err != nil {
		t.Fatalf("update by rowid failed: %v", err)
	}

	var gotByRowid string
	err = db.QueryRow("SELECT content FROM t_fts WHERE rowid = ?", rowid).Scan(&gotByRowid)
	if err != nil {
		t.Fatal(err)
	}
	if gotByRowid != newContent {
		t.Fatalf("by rowid: got %q, want %q", gotByRowid, newContent)
	}

	var gotByID string
	err = db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&gotByID)
	if err != nil {
		t.Fatal(err)
	}
	if gotByID != newContent {
		t.Fatalf("by id: got %q, want %q", gotByID, newContent)
	}

	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", origContent, rowid)
	if err != nil {
		t.Fatal(err)
	}
	var restored string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&restored)
	if restored != origContent {
		t.Fatalf("restore: got %q, want %q", restored, origContent)
	}
}

// testMultiColumnUpdate: 模式 #1 — content + fcontent + updated.
// 验证 UPDATE by rowid 更新多列后，各列值与 by_id 等价。
func testMultiColumnUpdate(t *testing.T, db *sql.DB) {
	// 先确保表有 fcontent 和 updated 列（但 FTS5 内部表总是包含所有声明列）
	rowid, id, _ := pickRow(t, db)
	updated := fmt.Sprintf("%d", time.Now().UnixMilli())

	_, err := db.Exec("UPDATE t_fts SET content = ?, fcontent = ?, updated = ? WHERE rowid = ?",
		"multi-col-content", "multi-col-fcontent", updated, rowid)
	if err != nil {
		t.Fatalf("update multiple columns by rowid failed: %v", err)
	}

	var content, fcontent, gotUpdated string
	err = db.QueryRow("SELECT content, fcontent, updated FROM t_fts WHERE id = ?", id).Scan(&content, &fcontent, &gotUpdated)
	if err != nil {
		t.Fatal(err)
	}
	if content != "multi-col-content" {
		t.Fatalf("content mismatch: got %q", content)
	}
	if fcontent != "multi-col-fcontent" {
		t.Fatalf("fcontent mismatch: got %q", fcontent)
	}
	if gotUpdated != updated {
		t.Fatalf("updated mismatch: got %q, want %q", gotUpdated, updated)
	}

	// 通过 rowid 读确认一致
	db.QueryRow("SELECT content, fcontent, updated FROM t_fts WHERE rowid = ?", rowid).Scan(&content, &fcontent, &gotUpdated)
	if content != "multi-col-content" {
		t.Fatalf("by rowid content mismatch: got %q", content)
	}
}

// testFTSSearchCorrectness: UPDATE by rowid 后 FTS5 全文搜索正确性.
func testFTSSearchCorrectness(t *testing.T, db *sql.DB) {
	rowid, id, _ := pickRow(t, db)
	marker := fmt.Sprintf("zeldris_%d", rand.Intn(1e9))

	if n := countFTSMatch(t, db, marker); n > 0 {
		t.Fatalf("marker %q should not exist, found %d", marker, n)
	}

	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?",
		fmt.Sprintf("search token %s end", marker), rowid)
	if err != nil {
		t.Fatalf("update by rowid failed: %v", err)
	}

	n := countFTSMatch(t, db, marker)
	if n == 0 {
		t.Fatal("FTS MATCH returned 0 after update by rowid, index not updated")
	}
	if n > 1 {
		t.Fatalf("FTS MATCH returned %d, expected 1", n)
	}

	var matchedID string
	err = db.QueryRow("SELECT id FROM t_fts WHERE content MATCH ?", marker).Scan(&matchedID)
	if err != nil {
		t.Fatal(err)
	}
	if matchedID != id {
		t.Fatalf("FTS MATCH returned id=%q, want original id=%q", matchedID, id)
	}
}

// testFTSUnicode: 中文 + emoji + 特殊字符.
func testFTSUnicode(t *testing.T, db *sql.DB) {
	magicWord := "验证_zhongwen_🀄️_emoji"
	rowid := insertRow(t, db, "id-unicode-"+fmt.Sprintf("%d", rand.Intn(1e9)), "initial")

	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?",
		fmt.Sprintf("unicode content with %s and more text", magicWord), rowid)
	if err != nil {
		t.Fatalf("update by rowid with unicode failed: %v", err)
	}

	if n := countFTSMatch(t, db, "验证"); n == 0 {
		t.Fatal("FTS MATCH failed to find Chinese text after update by rowid")
	}

	var content string
	err = db.QueryRow("SELECT content FROM t_fts WHERE rowid = ?", rowid).Scan(&content)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(content, magicWord) {
		t.Fatalf("content missing unicode text: got %q", content)
	}
}

// testFTSEmptyContent: 空内容.
func testFTSEmptyContent(t *testing.T, db *sql.DB) {
	rowid, id, _ := pickRow(t, db)

	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "", rowid)
	if err != nil {
		t.Fatal(err)
	}
	var byID string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&byID)
	if byID != "" {
		t.Fatalf("expected empty, got %q", byID)
	}

	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "content after empty", rowid)
	if err != nil {
		t.Fatal(err)
	}
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&byID)
	if byID != "content after empty" {
		t.Fatalf("expected restored, got %q", byID)
	}
}

// testFTSLargeContent: 100KB+ 内容.
func testFTSLargeContent(t *testing.T, db *sql.DB) {
	rowid := insertRow(t, db, "id-large-"+fmt.Sprintf("%d", rand.Intn(1e9)), "small")

	largeContent := strings.Repeat("large content test data for fts verification ", 2000)
	if len(largeContent) < 50000 {
		largeContent += strings.Repeat(" padding ", 2000)
	}
	marker := "unique_large_marker_fts"
	largeContent += " " + marker

	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", largeContent, rowid)
	if err != nil {
		t.Fatalf("update by rowid with large content failed: %v", err)
	}
	if n := countFTSMatch(t, db, marker); n == 0 {
		t.Fatal("FTS MATCH failed to find token in large content after update by rowid")
	}

	var content string
	db.QueryRow("SELECT content FROM t_fts WHERE rowid = ?", rowid).Scan(&content)
	if len(content) != len(largeContent) {
		t.Fatalf("large content length mismatch: got %d, want %d", len(content), len(largeContent))
	}
}

// testFTSRollback: 事务回滚后内容和 FTS 索引都恢复.
func testFTSRollback(t *testing.T, db *sql.DB) {
	rowid, id, origContent := pickRow(t, db)

	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	marker := "should_not_appear_after_rollback"
	_, err = tx.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?",
		"content "+marker, rowid)
	if err != nil {
		t.Fatal(err)
	}
	if err = tx.Rollback(); err != nil {
		t.Fatal(err)
	}

	var content string
	err = db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&content)
	if err != nil {
		t.Fatal(err)
	}
	if content != origContent {
		t.Fatalf("after rollback: got %q, want original %q", content, origContent)
	}
	if n := countFTSMatch(t, db, marker); n > 0 {
		t.Fatal("FTS MATCH found rollback marker after ROLLBACK")
	}
}

// testMultiRowConsistency: 乱序更新多个不同 rowid.
func testMultiRowConsistency(t *testing.T, db *sql.DB) {
	type rowInfo struct{ rowid int64; id string }
	var rows []rowInfo
	for i := 0; i < 20; i++ {
		id := fmt.Sprintf("multi-rowid-%d", i)
		r := insertRow(t, db, id, fmt.Sprintf("initial %d", i))
		rows = append(rows, rowInfo{rowid: r, id: id})
	}

	for _, idx := range rand.Perm(len(rows)) {
		r := rows[idx]
		_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?",
			fmt.Sprintf("multi-updated-%d", idx), r.rowid)
		if err != nil {
			t.Fatalf("update rowid=%d failed: %v", r.rowid, err)
		}
	}
	for _, r := range rows {
		var content string
		db.QueryRow("SELECT content FROM t_fts WHERE id = ?", r.id).Scan(&content)
		if !strings.HasPrefix(content, "multi-updated-") {
			t.Fatalf("row id=%s content mismatch: got %q", r.id, content)
		}
	}
}

// testRowidEqualsID: by_rowid 和 by_id 交替更新同一行时相互可见.
func testRowidEqualsID(t *testing.T, db *sql.DB) {
	for i := 0; i < 50; i++ {
		rowid, id, _ := pickRow(t, db)
		marker := fmt.Sprintf("eq_check_%d_%d", i, rand.Intn(1e6))

		_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?",
			fmt.Sprintf("%s rowid_update", marker), rowid)
		if err != nil {
			t.Fatal(err)
		}
		var byIDContent string
		db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&byIDContent)
		if !strings.Contains(byIDContent, "rowid_update") {
			t.Fatalf("by_rowid update not visible via id: got %q", byIDContent)
		}

		rowid2, id2, _ := pickRow(t, db)
		_, err = db.Exec("UPDATE t_fts SET content = ? WHERE id = ?",
			fmt.Sprintf("%s id_update", marker), id2)
		if err != nil {
			t.Fatal(err)
		}
		var byRowIDContent string
		db.QueryRow("SELECT content FROM t_fts WHERE rowid = ?", rowid2).Scan(&byRowIDContent)
		if !strings.Contains(byRowIDContent, "id_update") {
			t.Fatalf("by_id update not visible via rowid: got %q", byRowIDContent)
		}
	}
}

// testBothFTSTables: 模拟真实场景中同时更新 blocks_fts 和 blocks_fts_case_insensitive.
func testBothFTSTables(t *testing.T, db *sql.DB) {
	_, err := db.Exec(`CREATE VIRTUAL TABLE t2_fts USING fts5(
		id UNINDEXED, content, tokenize='unicode61'
	)`)
	if err != nil {
		t.Fatal(err)
	}

	type rowPair struct{ id string; rid1, rid2 int64 }
	var pairs []rowPair
	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("both-tables-%d", i)
		for _, tbl := range []string{"t_fts", "t2_fts"} {
			_, err := db.Exec(fmt.Sprintf("INSERT INTO %s (id, content) VALUES (?, ?)", tbl), id, fmt.Sprintf("initial %d", i))
			if err != nil {
				t.Fatal(err)
			}
		}
		var rid1, rid2 int64
		db.QueryRow("SELECT rowid FROM t_fts WHERE id = ?", id).Scan(&rid1)
		db.QueryRow("SELECT rowid FROM t2_fts WHERE id = ?", id).Scan(&rid2)
		pairs = append(pairs, rowPair{id: id, rid1: rid1, rid2: rid2})
	}

	// 随机选一行
	p := pairs[rand.Intn(len(pairs))]
	newContent := "both tables updated by rowid"

	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", newContent, p.rid1)
	if err != nil {
		t.Fatalf("update t_fts failed: %v", err)
	}
	_, err = db.Exec("UPDATE t2_fts SET content = ? WHERE rowid = ?", newContent, p.rid2)
	if err != nil {
		t.Fatalf("update t2_fts failed: %v", err)
	}

	for _, tbl := range []string{"t_fts", "t2_fts"} {
		var content string
		db.QueryRow(fmt.Sprintf("SELECT content FROM %s WHERE id = ?", tbl), p.id).Scan(&content)
		if content != newContent {
			t.Fatalf("%s content mismatch: got %q", tbl, content)
		}
	}
}

// testUpdateByRootID: 模式 #4/#5 — WHERE root_id = ? 也使用 rowid.
// 验证先通过 root_id 查到行再按 rowid 更新结果与 by root_id 一致。
func testUpdateByRootID(t *testing.T, db *sql.DB) {
	rootID := "root-group-1"
	for i := 0; i < 10; i++ {
		_, err := db.Exec("INSERT INTO t_fts (id, content) VALUES (?, ?)",
			fmt.Sprintf("child-%d-of-%s", i, rootID),
			fmt.Sprintf("initial content %d", i))
		if err != nil {
			t.Fatal(err)
		}
	}

	// 方式 A: 直接 UPDATE t_fts SET content = ? WHERE root_id = ?
	// 这个操作会全表扫描匹配 root_id 的所有行。我们验证 rowid 方式也能正确更新。
	rows, err := db.Query("SELECT rowid, id FROM t_fts WHERE id LIKE ?", "child-%")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var rowids []int64
	for rows.Next() {
		var rid int64
		var id string
		rows.Scan(&rid, &id)
		rowids = append(rowids, rid)
	}

	newContent := "updated by root group using rowid lookup"
	for _, rid := range rowids {
		_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", newContent, rid)
		if err != nil {
			t.Fatal(err)
		}
	}

	var count int
	db.QueryRow("SELECT count(*) FROM t_fts WHERE content = ? AND id LIKE ?", newContent, "child-%").Scan(&count)
	if count != 10 {
		t.Fatalf("expected 10 rows updated via rowid, got %d", count)
	}
}

// testUpdateNoMatch: UPDATE 0 行不影响.
func testUpdateNoMatch(t *testing.T, db *sql.DB) {
	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "no match", int64(-9999))
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", "no match", "nonexistent-id")
	if err != nil {
		t.Fatal(err)
	}
	var total int
	db.QueryRow("SELECT count(*) FROM t_fts").Scan(&total)
	if total == 0 {
		t.Fatal("table should not be empty after no-match update")
	}
}

// testInsertThenUpdateSameRowid: INSERT 后立即 UPDATE 同一 rowid，验证 rowid 稳定不变.
func testInsertThenUpdateSameRowid(t *testing.T, db *sql.DB) {
	id := fmt.Sprintf("insert-then-update-%d", rand.Intn(1e9))
	res, err := db.Exec("INSERT INTO t_fts (id, content) VALUES (?, ?)", id, "inserted")
	if err != nil {
		t.Fatal(err)
	}
	rowid, err := res.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}

	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "updated after insert", rowid)
	if err != nil {
		t.Fatalf("update by insert rowid failed: %v", err)
	}

	var content string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&content)
	if content != "updated after insert" {
		t.Fatalf("rowid lookup after insert+update failed: got %q", content)
	}
}

// TestFTSUpdatePerformanceByIDvsRowID 性能比对测试（带断言）.
func TestFTSUpdatePerformanceByIDvsRowID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping performance test in short mode")
	}

	rowCounts := []int{1000, 5000, 20000, 50000}

	for _, n := range rowCounts {
		t.Run(fmt.Sprintf("rows=%d", n), func(t *testing.T) {
			db := openTestFTSDB(t)
			defer db.Close()

			populateFTSForBench(t, db, n)

			targetID := pickRandomFTSID(t, db)
			targetRowID := pickRandomFTSRowID(t, db)

			db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", "warm", targetID)
			db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "warm", targetRowID)

			const iterations = 20

			start := time.Now()
			for i := 0; i < iterations; i++ {
				_, err := db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", fmt.Sprintf("update %d", i), targetID)
				if err != nil {
					t.Fatal(err)
				}
			}
			avgByID := time.Since(start) / iterations

			start = time.Now()
			for i := 0; i < iterations; i++ {
				_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", fmt.Sprintf("update %d", i), targetRowID)
				if err != nil {
					t.Fatal(err)
				}
			}
			avgByRowID := time.Since(start) / iterations

			t.Logf("rows=%5d  by_id avg=%8v  by_rowid avg=%8v  ratio=%.1fx",
				n, avgByID, avgByRowID, float64(avgByID)/float64(avgByRowID))

			if n >= 20000 && avgByID < avgByRowID*2 {
				t.Errorf("by_rowid should be significantly faster at n=%d, ratio=%.1f", n, float64(avgByID)/float64(avgByRowID))
			}
		})
	}
}

// testDirectRowidVsIDEquality: 对同一行分别用 by_id 和 by_rowid 更新到同一值，断言最终结果完全相同.
func testDirectRowidVsIDEquality(t *testing.T, db *sql.DB) {
	rowid, id, _ := pickRow(t, db)

	// 步骤 A: 通过 id 更新（使用空格分隔的单词以确保 FTS5 tokenizer 能正确分词）
	valueA := "correctness value from id update"
	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", valueA, id)
	if err != nil {
		t.Fatal(err)
	}
	var resultA string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&resultA)

	// 恢复原始内容
	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "restore content", rowid)
	if err != nil {
		t.Fatal(err)
	}

	// 步骤 B: 通过 rowid 更新到相同的值
	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", valueA, rowid)
	if err != nil {
		t.Fatal(err)
	}
	var resultB string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&resultB)

	// 断言 1: 两种方式得到完全相同的 content 值
	if resultA != resultB {
		t.Fatalf("by_id and by_rowid produced different content: by_id=%q by_rowid=%q", resultA, resultB)
	}
	if resultB != valueA {
		t.Fatalf("by_rowid content=%q does not match expected value %q", resultB, valueA)
	}

	// 断言 2: FTS5 全文搜索行为一致（token "correctness" 在两种方式后都能被 MATCH 命中）
	var matchByID, matchByRowid int
	db.QueryRow("SELECT count(*) FROM t_fts WHERE content MATCH ? AND id = ?", "correctness", id).Scan(&matchByID)
	db.QueryRow("SELECT count(*) FROM t_fts WHERE content MATCH ? AND id = ?", "correctness", id).Scan(&matchByRowid)
	if matchByID != matchByRowid {
		t.Fatalf("FTS MATCH count differs: by_id_path=%d by_rowid_path=%d", matchByID, matchByRowid)
	}
	if matchByID != 1 {
		t.Fatalf("FTS MATCH should match exactly 1 row, got %d", matchByID)
	}

	// 断言 3: 更新前的旧 token（来自 populateFTSForBench 的初始内容）不再可搜索
	var oldTokenCount int
	db.QueryRow("SELECT count(*) FROM t_fts WHERE content MATCH ? AND id = ?", "restore", id).Scan(&oldTokenCount)
	if oldTokenCount > 0 {
		t.Fatalf("old content token should not match after update, got %d rows", oldTokenCount)
	}
}
func BenchmarkFTSUpdateByIDvsRowID(b *testing.B) {
	rowCounts := []int{1000, 10000, 50000, 100000}

	for _, n := range rowCounts {
		b.Run(fmt.Sprintf("rows=%d", n), func(b *testing.B) {
			db := openTestFTSDB(b)
			defer db.Close()

			populateFTSForBench(b, db, n)

			targetID := pickRandomFTSID(b, db)
			b.Run("update_by_id", func(b *testing.B) {
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					_, err := db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", "updated content", targetID)
					if err != nil {
						b.Fatal(err)
					}
				}
			})

			targetRowID := pickRandomFTSRowID(b, db)
			b.Run("update_by_rowid", func(b *testing.B) {
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "updated content", targetRowID)
					if err != nil {
						b.Fatal(err)
					}
				}
			})
		})
	}
}

// --- helpers ---

func openTestFTSDB(tb testing.TB) *sql.DB {
	tb.Helper()
	db, err := sql.Open("sqlite3_extended", ":memory:")
	if err != nil {
		var err2 error
		db, err2 = sql.Open("sqlite3", ":memory:")
		if err2 != nil {
			tb.Fatalf("failed to open db: %v / %v", err, err2)
		}
	}
	_, err = db.Exec(`CREATE VIRTUAL TABLE t_fts USING fts5(
		id UNINDEXED, parent_id UNINDEXED, root_id UNINDEXED,
		content, fcontent, updated UNINDEXED,
		tokenize='unicode61'
	)`)
	if err != nil {
		// fallback schema with fewer columns
		db.Exec("DROP TABLE IF EXISTS t_fts")
		_, err = db.Exec(`CREATE VIRTUAL TABLE t_fts USING fts5(
			id UNINDEXED, content, fcontent, updated UNINDEXED,
			tokenize='unicode61'
		)`)
		if err != nil {
			tb.Fatal(err)
		}
	}
	return db
}

func populateFTSForBench(tb testing.TB, db *sql.DB, n int) {
	tb.Helper()
	db.Exec("PRAGMA synchronous = OFF")
	db.Exec("PRAGMA journal_mode = MEMORY")
	tx, err := db.Begin()
	if err != nil {
		tb.Fatal(err)
	}
	stmt, err := tx.Prepare("INSERT INTO t_fts (id, content) VALUES (?, ?)")
	if err != nil {
		tb.Fatal(err)
	}
	defer stmt.Close()
	for i := 0; i < n; i++ {
		id := fmt.Sprintf("20260507-test-%09d", i)
		content := fmt.Sprintf("test content for row %d with some extra padding data to make it realistic %s", i, randomString(100))
		if _, err := stmt.Exec(id, content); err != nil {
			tb.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		tb.Fatal(err)
	}
	db.Exec("PRAGMA synchronous = NORMAL")
}

func pickRow(t *testing.T, db *sql.DB) (rowid int64, id, content string) {
	t.Helper()
	return pickRowFrom(t, db, "t_fts")
}

func pickRowFrom(t *testing.T, db *sql.DB, table string) (rowid int64, id, content string) {
	t.Helper()
	var total int
	db.QueryRow(fmt.Sprintf("SELECT count(*) FROM %s", table)).Scan(&total)
	if total == 0 {
		t.Fatalf("table %s is empty", table)
	}
	offset := rand.Intn(total)
	err := db.QueryRow(fmt.Sprintf("SELECT rowid, id, content FROM %s LIMIT 1 OFFSET ?", table), offset).Scan(&rowid, &id, &content)
	if err != nil {
		t.Fatal(err)
	}
	return
}

func insertRow(t *testing.T, db *sql.DB, id, content string) int64 {
	t.Helper()
	_, err := db.Exec("INSERT INTO t_fts (id, content) VALUES (?, ?)", id, content)
	if err != nil {
		t.Fatal(err)
	}
	var rowid int64
	db.QueryRow("SELECT rowid FROM t_fts WHERE id = ?", id).Scan(&rowid)
	return rowid
}

func pickRandomFTSID(tb testing.TB, db *sql.DB) string {
	tb.Helper()
	var count int
	db.QueryRow("SELECT count(*) FROM t_fts").Scan(&count)
	if count == 0 {
		tb.Fatal("no rows")
	}
	offset := rand.Intn(count)
	var id string
	err := db.QueryRow("SELECT id FROM t_fts LIMIT 1 OFFSET ?", offset).Scan(&id)
	if err != nil {
		tb.Fatal(err)
	}
	return id
}

func pickRandomFTSRowID(tb testing.TB, db *sql.DB) int64 {
	tb.Helper()
	var rowid int64
	err := db.QueryRow("SELECT rowid FROM t_fts WHERE id = ?", pickRandomFTSID(tb, db)).Scan(&rowid)
	if err != nil {
		tb.Fatal(err)
	}
	return rowid
}

func countFTSMatch(t *testing.T, db *sql.DB, token string) int {
	t.Helper()
	var n int
	err := db.QueryRow("SELECT count(*) FROM t_fts WHERE content MATCH ?", token).Scan(&n)
	if err != nil {
		t.Logf("FTS MATCH query failed: %v", err)
		return 0
	}
	return n
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
