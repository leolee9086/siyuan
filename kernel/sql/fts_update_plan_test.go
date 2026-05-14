package sql

import (
	"database/sql"
	"fmt"
	"sync"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// 以下测试验证生产代码更新计划的正确性。
// 计划要点：
//   1. insertBlocks0 中在 FTS INSERT 后通过 last_insert_rowid() 捕获 rowid
//   2. 存入 blockFTSRowIDs 映射 (blockID → {ftsRowid, ftsCiRowid})
//   3. updateBlockContent/updateRootContent/indexNode 改用 WHERE rowid = ?
//
// 测试在 test 内部模拟这套机制，不依赖生产代码的任何改动。
// 当生产代码按计划更新后，这些测试应全部通过（无需修改）。

// --- 模拟生产代码的 rowid 映射机制 ---

type planRowidPair struct {
	rowid   int64 // blocks_fts.rowid
	rowidCI int64 // blocks_fts_case_insensitive.rowid
}

var (
	planRowidMap   map[string]*planRowidPair
	planRowidLock  sync.RWMutex
)

func init() {
	ClearPlanRowidMap()
}

func ClearPlanRowidMap() {
	planRowidLock.Lock()
	defer planRowidLock.Unlock()
	planRowidMap = make(map[string]*planRowidPair)
}

func PlanStoreFTSRowIDs(blockIDs []string, ftsFirst, ciFirst int64) {
	planRowidLock.Lock()
	defer planRowidLock.Unlock()
	for i, id := range blockIDs {
		planRowidMap[id] = &planRowidPair{
			rowid:   ftsFirst + int64(i),
			rowidCI: ciFirst + int64(i),
		}
	}
}

func PlanGetFTSRowIDs(blockID string) (pair *planRowidPair, ok bool) {
	planRowidLock.RLock()
	defer planRowidLock.RUnlock()
	pair, ok = planRowidMap[blockID]
	return
}

func PlanGetRowid(blockID string) (int64, bool) {
	pair, ok := PlanGetFTSRowIDs(blockID)
	if !ok {
		return 0, false
	}
	return pair.rowid, true
}

// --- 模拟 insertBlocks0 中 FTS INSERT + rowid 捕获 ---

// planInsertBlocks 模拟 insertBlocks0 的行为：插入 blocks 表 + 插入 FTS 表并捕获 rowid。
// blocks 表是隐含测试表，FTS 表用 t_fts。
// 返回 map[blockID]→pair。
func planInsertBlocks(t *testing.T, db *sql.DB, blockIDs, contents []string, hasCI bool) {
	t.Helper()
	if len(blockIDs) != len(contents) {
		t.Fatal("blockIDs and contents length mismatch")
	}

	// 插入 blocks 表（模拟）
	for i, id := range blockIDs {
		_, err := db.Exec("UPDATE t_blocks SET content = ? WHERE id = ?", contents[i], id)
		if err != nil {
			// blocks 表不存在，跳过
		}
	}

	// 批量插入 blocks_fts（模拟 batch INSERT）
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}

	// 构建批量 INSERT 语句
	valueStrings := make([]string, 0, len(blockIDs))
	valueArgs := make([]any, 0, len(blockIDs)*2)
	for i, id := range blockIDs {
		valueStrings = append(valueStrings, "(?, ?)")
		valueArgs = append(valueArgs, id)
		valueArgs = append(valueArgs, contents[i])
	}
	stmt := fmt.Sprintf("INSERT INTO t_fts (id, content) VALUES %s", joinStrings(valueStrings, ","))
	_, err = tx.Exec(stmt, valueArgs...)
	if err != nil {
		tx.Rollback()
		t.Fatal(err)
	}

	// 捕获 blocks_fts 的 last_insert_rowid（返回的是最后一条的 rowid，需推导第一条）
	var lastFTSRowid int64
	tx.QueryRow("SELECT last_insert_rowid()").Scan(&lastFTSRowid)
	ftsFirst := lastFTSRowid - int64(len(blockIDs)) + 1

	var lastCIRowid int64
	var ciFirst int64
	if hasCI {
		_, err = tx.Exec(fmt.Sprintf("INSERT INTO t_fts (id, content) VALUES %s", joinStrings(valueStrings, ",")), valueArgs...)
		if err != nil {
			tx.Rollback()
			t.Fatal(err)
		}
		tx.QueryRow("SELECT last_insert_rowid()").Scan(&lastCIRowid)
		ciFirst = lastCIRowid - int64(len(blockIDs)) + 1
	}

	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// 存入映射（与生产代码相同）
	PlanStoreFTSRowIDs(blockIDs, ftsFirst, ciFirst)
}

func joinStrings(ss []string, sep string) string {
	var r string
	for i, s := range ss {
		if i > 0 {
			r += sep
		}
		r += s
	}
	return r
}

// 模拟 updateBlockContent 中使用 rowid 更新 FTS
func planUpdateBlockContentByRowid(t *testing.T, db *sql.DB, id, newContent string) {
	t.Helper()

	pair, ok := PlanGetFTSRowIDs(id)
	if !ok {
		// fallback 到 WHERE id = ?
		_, err := db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", newContent, id)
		if err != nil {
			t.Fatal(err)
		}
		return
	}

	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", newContent, pair.rowid)
	if err != nil {
		t.Fatal(err)
	}
	if pair.rowidCI > 0 {
		_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", newContent, pair.rowidCI)
		if err != nil {
			t.Fatal(err)
		}
	}
}

// --- 测试用例 ---

// TestPlanMappingStoreAndGet: 验证映射的存储/查询正确.
func TestPlanMappingStoreAndGet(t *testing.T) {
	ClearPlanRowidMap()

	blockIDs := []string{"id-a", "id-b", "id-c"}
	PlanStoreFTSRowIDs(blockIDs, 100, 200)

	pair, ok := PlanGetFTSRowIDs("id-a")
	if !ok {
		t.Fatal("id-a not found")
	}
	if pair.rowid != 100 {
		t.Fatalf("id-a fts rowid: got %d, want 100", pair.rowid)
	}
	if pair.rowidCI != 200 {
		t.Fatalf("id-a ci rowid: got %d, want 200", pair.rowidCI)
	}

	pair, ok = PlanGetFTSRowIDs("id-b")
	if !ok {
		t.Fatal("id-b not found")
	}
	if pair.rowid != 101 {
		t.Fatalf("id-b fts rowid: got %d, want 101", pair.rowid)
	}
	if pair.rowidCI != 201 {
		t.Fatalf("id-b ci rowid: got %d, want 201", pair.rowidCI)
	}

	// 不存在的 ID
	_, ok = PlanGetFTSRowIDs("nonexistent")
	if ok {
		t.Fatal("nonexistent id should not be found")
	}

	// 覆盖: 相同 blockID 重新存储后取新值
	PlanStoreFTSRowIDs([]string{"id-a"}, 999, 888)
	pair, ok = PlanGetFTSRowIDs("id-a")
	if !ok {
		t.Fatal("id-a not found after overwrite")
	}
	if pair.rowid != 999 || pair.rowidCI != 888 {
		t.Fatalf("overwrite: got fts=%d ci=%d, want 999 888", pair.rowid, pair.rowidCI)
	}
}

// TestPlanMappingClear: 验证清空映射后查不到.
func TestPlanMappingClear(t *testing.T) {
	ClearPlanRowidMap()
	PlanStoreFTSRowIDs([]string{"id-x"}, 1, 2)
	ClearPlanRowidMap()
	_, ok := PlanGetFTSRowIDs("id-x")
	if ok {
		t.Fatal("mapping should be empty after ClearPlanRowidMap")
	}
}

// TestPlanMappingConcurrency: 验证并发读写无竞态.
func TestPlanMappingConcurrency(t *testing.T) {
	ClearPlanRowidMap()

	const goroutines = 20
	const opsPerGoroutine = 100
	done := make(chan bool, goroutines)

	for g := 0; g < goroutines; g++ {
		go func(gid int) {
			for i := 0; i < opsPerGoroutine; i++ {
				id := fmt.Sprintf("concurrent-id-%d-%d", gid, i)
				PlanStoreFTSRowIDs([]string{id}, int64(i), int64(i+10000))
				_, ok := PlanGetFTSRowIDs(id)
				if !ok {
					t.Errorf("concurrent: %s not found after store", id)
				}
			}
			done <- true
		}(g)
	}
	for g := 0; g < goroutines; g++ {
		<-done
	}
}

// TestPlanInsertThenUpdateByRowid: 模拟完整 INSERT → 捕获 rowid → UPDATE by rowid 流程.
func TestPlanInsertThenUpdateByRowid(t *testing.T) {
	db := openPlanTestDB(t)
	defer db.Close()
	ClearPlanRowidMap()

	blockIDs := []string{"plan-block-001", "plan-block-002", "plan-block-003"}
	contents := []string{"original content 001", "original content 002", "original content 003"}

	// 模拟 insertBlocks0: 批量插入 FTS + 捕获 rowid
	planInsertBlocks(t, db, blockIDs, contents, true)
	for _, id := range blockIDs {
		pair, ok := PlanGetFTSRowIDs(id)
		if !ok {
			t.Fatalf("block %s not in mapping after insert", id)
		}
		if pair.rowid <= 0 {
			t.Fatalf("block %s fts rowid = %d (invalid)", id, pair.rowid)
		}
		if pair.rowidCI <= 0 {
			t.Fatalf("block %s ci rowid = %d (invalid)", id, pair.rowidCI)
		}
	}

	// 验证插入的内容可通过 rowid 查询
	var content string
	db.QueryRow("SELECT content FROM t_fts WHERE rowid = ?", PlanGetRowidOrFail(t, blockIDs[0])).Scan(&content)
	if content != "original content 001" {
		t.Fatalf("inserted content mismatch: got %q", content)
	}

	// 模拟 updateBlockContent: 用 rowid 更新 FTS
	newContent := "updated via rowid approach"
	planUpdateBlockContentByRowid(t, db, blockIDs[1], newContent)

	// 验证更新后的内容
	var updated string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", blockIDs[1]).Scan(&updated)
	if updated != newContent {
		t.Fatalf("update by rowid failed: got %q, want %q", updated, newContent)
	}

	// 验证 FTS 索引正确更新
	var matchCount int
	db.QueryRow("SELECT count(*) FROM t_fts WHERE content MATCH ?", "rowid").Scan(&matchCount)
	if matchCount == 0 {
		t.Fatal("FTS MATCH returned 0 after update by rowid, index not updated")
	}

	// 验证其他行未被影响
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", blockIDs[0]).Scan(&content)
	if content != "original content 001" {
		t.Fatalf("unrelated row was modified: got %q", content)
	}
}

// TestPlanUpdateByRowidMatchesByID: 验证对同一行用 rowid 和用 id 更新产生完全相同的结果.
func TestPlanUpdateByRowidMatchesByID(t *testing.T) {
	db := openPlanTestDB(t)
	defer db.Close()
	ClearPlanRowidMap()

	// 插入一行并捕获 rowid
	id := "plan-match-test-id"
	planInsertBlocks(t, db, []string{id}, []string{"initial"}, true)
	pair, _ := PlanGetFTSRowIDs(id)

	// 用 rowid 更新
	rowidContent := "content via rowid"
	_, err := db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", rowidContent, pair.rowid)
	if err != nil {
		t.Fatal(err)
	}

	// 也用 ci rowid 更新
	if pair.rowidCI > 0 {
		_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", rowidContent, pair.rowidCI)
		if err != nil {
			t.Fatal(err)
		}
	}

	var resultByID string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&resultByID)
	if resultByID != rowidContent {
		t.Fatalf("by_rowid content not visible via id query: got %q, want %q", resultByID, rowidContent)
	}
}

// TestPlanInsertThenUpdateSameRowidStable: 验证 INSERT 后 rowid 不变，可多次 UPDATE.
func TestPlanInsertThenUpdateSameRowidStable(t *testing.T) {
	db := openPlanTestDB(t)
	defer db.Close()
	ClearPlanRowidMap()

	id := "plan-stable-test"
	planInsertBlocks(t, db, []string{id}, []string{"v0"}, true)
	pair0, _ := PlanGetFTSRowIDs(id)

	// 多次更新，每次都通过 rowid
	for v := 1; v <= 10; v++ {
		content := fmt.Sprintf("v%d", v)
		planUpdateBlockContentByRowid(t, db, id, content)

		var got string
		db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&got)
		if got != content {
			t.Fatalf("iteration v%d: got %q, want %q", v, got, content)
		}
	}

	// rowid 不应变化
	pair1, _ := PlanGetFTSRowIDs(id)
	if pair0.rowid != pair1.rowid {
		t.Fatalf("rowid changed: was %d, now %d", pair0.rowid, pair1.rowid)
	}
}

// TestPlanUpdateByRowidFallback: 映射不存在时退化为 WHERE id = ?.
func TestPlanUpdateByRowidFallback(t *testing.T) {
	db := openPlanTestDB(t)
	defer db.Close()
	ClearPlanRowidMap()

	// 插入行但不存映射
	id := "plan-fallback-test"
	_, err := db.Exec("INSERT INTO t_fts (id, content) VALUES (?, ?)", id, "fallback original")
	if err != nil {
		t.Fatal(err)
	}

	// 此时映射不存在，planUpdateBlockContentByRowid 应 fallback 到 WHERE id = ?
	newContent := "updated via fallback"
	planUpdateBlockContentByRowid(t, db, id, newContent)

	var got string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&got)
	if got != newContent {
		t.Fatalf("fallback update failed: got %q, want %q", got, newContent)
	}
}

// TestPlanMultiBatchRowidContinuity: 验证批量插入时 rowid 连续性（last_insert_rowid + offset）.
func TestPlanMultiBatchRowidContinuity(t *testing.T) {
	db := openPlanTestDB(t)
	defer db.Close()
	ClearPlanRowidMap()

	// 检查当前 t_fts 的 rowid 初始值
	var before int64
	db.QueryRow("SELECT COALESCE(MAX(rowid), 0) FROM t_fts").Scan(&before)

	batch1 := []string{"batch1-a", "batch1-b", "batch1-c"}
	planInsertBlocks(t, db, batch1, []string{"b1a", "b1b", "b1c"}, true)

	for i, id := range batch1 {
		pair, ok := PlanGetFTSRowIDs(id)
		if !ok {
			t.Fatalf("%s not in mapping", id)
		}
		expected := before + int64(1+i)
		if pair.rowid != expected {
			t.Fatalf("%s fts rowid: got %d, want %d (batch continuity broken)", id, pair.rowid, expected)
		}
	}
}

// TestPlanBothFTSTablesRowidIndependence: 验证两张 FTS 表的 rowid 独立.
func TestPlanBothFTSTablesRowidIndependence(t *testing.T) {
	db := openPlanTestDB(t)
	defer db.Close()
	ClearPlanRowidMap()

	// 创建第二张 FTS 表（模拟 blocks_fts_case_insensitive）
	_, err := db.Exec(`CREATE VIRTUAL TABLE t2_fts USING fts5(
		id UNINDEXED, content, tokenize='unicode61'
	)`)
	if err != nil {
		t.Fatal(err)
	}

	// 插入一行，两张表各插入一行
	id := "plan-two-tables"
	tx, _ := db.Begin()
	tx.Exec("INSERT INTO t_fts (id, content) VALUES (?, ?)", id, "fts content")
	tx.Exec("INSERT INTO t2_fts (id, content) VALUES (?, ?)", id, "ci content")
	tx.Commit()

	var ftsRowid, ciRowid int64
	db.QueryRow("SELECT rowid FROM t_fts WHERE id = ?", id).Scan(&ftsRowid)
	db.QueryRow("SELECT rowid FROM t2_fts WHERE id = ?", id).Scan(&ciRowid)

	// 模拟 storeFTSRowIDs
	PlanStoreFTSRowIDs([]string{id}, ftsRowid, ciRowid)

	pair, ok := PlanGetFTSRowIDs(id)
	if !ok {
		t.Fatal("mapping not found")
	}
	if pair.rowid != ftsRowid {
		t.Fatalf("fts rowid: stored %d != actual %d", pair.rowid, ftsRowid)
	}
	if pair.rowidCI != ciRowid {
		t.Fatalf("ci rowid: stored %d != actual %d", pair.rowidCI, ciRowid)
	}

	// 分别用各自的 rowid 更新
	_, err = db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "only fts updated", pair.rowid)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec("UPDATE t2_fts SET content = ? WHERE rowid = ?", "only ci updated", pair.rowidCI)
	if err != nil {
		t.Fatal(err)
	}

	var ftsContent, ciContent string
	db.QueryRow("SELECT content FROM t_fts WHERE id = ?", id).Scan(&ftsContent)
	db.QueryRow("SELECT content FROM t2_fts WHERE id = ?", id).Scan(&ciContent)
	if ftsContent != "only fts updated" || ciContent != "only ci updated" {
		t.Fatalf("FTS/CI rowids not independent: fts=%q ci=%q", ftsContent, ciContent)
	}
}

// TestPlanUpdateByRowidPerformance: 验证映射 + rowid 更新有显著性能提升.
func TestPlanUpdateByRowidPerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping performance test in short mode")
	}

	db := openPlanTestDB(t)
	defer db.Close()
	ClearPlanRowidMap()

	const n = 30000
	populateFTSForBench(t, db, n)

	// 选择一行模拟映射存在
	id := pickRandomFTSID(t, db)
	var rowid int64
	db.QueryRow("SELECT rowid FROM t_fts WHERE id = ?", id).Scan(&rowid)
	PlanStoreFTSRowIDs([]string{id}, rowid, 0)

	// warm up
	db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", "warm", id)
	db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", "warm", rowid)

	const iterations = 30

	// by_id
	start := time.Now()
	for i := 0; i < iterations; i++ {
		db.Exec("UPDATE t_fts SET content = ? WHERE id = ?", fmt.Sprintf("a%d", i), id)
	}
	avgByID := time.Since(start) / iterations

	// by_rowid（通过映射获取 rowid）
	start = time.Now()
	for i := 0; i < iterations; i++ {
		db.Exec("UPDATE t_fts SET content = ? WHERE rowid = ?", fmt.Sprintf("b%d", i), rowid)
	}
	avgByRowid := time.Since(start) / iterations

	t.Logf("n=%d  by_id avg=%v  by_rowid(plan) avg=%v  ratio=%.1fx", n, avgByID, avgByRowid, float64(avgByID)/float64(avgByRowid))

	if avgByID < avgByRowid*2 {
		t.Errorf("plan: by_rowid should be faster at n=%d, ratio=%.1f", n, float64(avgByID)/float64(avgByRowid))
	}
}

// --- helpers ---

func openPlanTestDB(tb testing.TB) *sql.DB {
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
		id UNINDEXED, content, tokenize='unicode61'
	)`)
	if err != nil {
		tb.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS t_blocks (
		id TEXT PRIMARY KEY, content TEXT
	)`)
	if err != nil {
		tb.Log("t_blocks table creation skipped:", err)
	}
	return db
}

func PlanGetRowidOrFail(t *testing.T, id string) int64 {
	t.Helper()
	pair, ok := PlanGetFTSRowIDs(id)
	if !ok {
		t.Fatalf("rowid for %s not found", id)
	}
	return pair.rowid
}
