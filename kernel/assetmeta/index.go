package assetmeta

import (
	"database/sql"
	"path/filepath"
	"strings"
	"time"

	"github.com/siyuan-note/logging"
	_ "github.com/siyuan-note/siyuan/kernel/sql" // Ensure sqlite3_extended is registered
	"github.com/siyuan-note/siyuan/kernel/util"
)

var (
	indexDB *sql.DB
)

func InitIndexDB() {
	dbPath := filepath.Join(util.TempDir, "s-forge-asset-meta.db")
	util.LogDatabaseSize(dbPath)

	// Use standard sqlite3 driver for now, or reuse "sqlite3_extended" if available and needed.
	// Since we don't need custom regex yet, sqlite3 is fine.
	dsn := dbPath + "?_journal_mode=WAL" +
		"&_synchronous=OFF" +
		"&_mmap_size=2684354560" +
		"&_secure_delete=OFF" +
		"&_cache_size=-20480" +
		"&_page_size=32768" +
		"&_busy_timeout=7000" +
		"&_ignore_check_constraints=ON" +
		"&_temp_store=MEMORY" +
		"&_case_sensitive_like=OFF"

	var err error
	indexDB, err = sql.Open("sqlite3_extended", dsn)
	if err != nil {
		logging.LogErrorf("create asset meta database failed: %s", err)
		return
	}

	indexDB.SetMaxIdleConns(5)
	indexDB.SetMaxOpenConns(5)
	indexDB.SetConnMaxLifetime(365 * 24 * time.Hour)

	initTables()
}

func CloseIndexDB() {
	if indexDB != nil {
		indexDB.Close()
	}
}

func initTables() {
	resetLegacyIndexTables()
	// 1. asset_meta table
	_, err := indexDB.Exec(`
    CREATE TABLE IF NOT EXISTS asset_meta (
        asset_key TEXT PRIMARY KEY,
        root_id TEXT NOT NULL,
        path TEXT NOT NULL,
        name TEXT,
        source TEXT,
        source_id TEXT,
        annotation TEXT,
        bound_block_id TEXT,
        star INTEGER DEFAULT 0,
        import_time INTEGER,
        width INTEGER,
        height INTEGER,
        file_size INTEGER,
        UNIQUE(root_id, path)
    )`)
	if err != nil {
		logging.LogErrorf("create table [asset_meta] failed: %s", err)
	}

	// 2. asset_tags table (One-to-Many)
	_, err = indexDB.Exec(`
    CREATE TABLE IF NOT EXISTS asset_tags (
        asset_key TEXT,
        tag TEXT,
        PRIMARY KEY(asset_key, tag)
    )`)
	if err != nil {
		logging.LogErrorf("create table [asset_tags] failed: %s", err)
	}
	// Indices for tags
	indexDB.Exec("CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag)")
	indexDB.Exec("CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_key ON asset_tags(asset_key)")
	indexDB.Exec("CREATE INDEX IF NOT EXISTS idx_asset_meta_root_path ON asset_meta(root_id, path)")

	// 3. asset_palettes table (For color search)
	// 存储 RGB 及转换后的 HSL/HSV
	_, err = indexDB.Exec(`
    CREATE TABLE IF NOT EXISTS asset_palettes (
        asset_key TEXT,
        r INTEGER, g INTEGER, b INTEGER,
        h INTEGER, -- Hue: 0-360
        s INTEGER, -- Saturation: 0-100
        l INTEGER, -- Lightness: 0-100
        ratio REAL,
        FOREIGN KEY(asset_key) REFERENCES asset_meta(asset_key)
    )`)
	if err != nil {
		logging.LogErrorf("create table [asset_palettes] failed: %s", err)
	}
	// Indices for color search
	indexDB.Exec("CREATE INDEX IF NOT EXISTS idx_palette_h ON asset_palettes(h)")
	indexDB.Exec("CREATE INDEX IF NOT EXISTS idx_palette_sl ON asset_palettes(s, l)")

	// 4. properties table for sync status
	_, err = indexDB.Exec(`
    CREATE TABLE IF NOT EXISTS properties (
        key TEXT PRIMARY KEY,
        value TEXT
    )`)
	if err != nil {
		logging.LogErrorf("create table [properties] failed: %s", err)
	}
}

// asset_meta.db 位于临时目录，JSON 主数据才是权威来源。检测到旧表时直接重建，避免长期保留双结构迁移分支。
func resetLegacyIndexTables() {
	rows, err := indexDB.Query("PRAGMA table_info(asset_meta)")
	if err != nil {
		logging.LogErrorf("inspect asset meta schema failed: %s", err)
		return
	}
	defer rows.Close()
	columns := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull, primaryKey int
		var defaultValue any
		if scanErr := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); scanErr != nil {
			logging.LogErrorf("inspect asset meta column failed: %s", scanErr)
			return
		}
		columns[name] = true
	}
	if len(columns) == 0 || (columns["asset_key"] && columns["root_id"] && columns["annotation"] && columns["bound_block_id"]) {
		return
	}
	if _, err = indexDB.Exec("DROP TABLE IF EXISTS asset_tags; DROP TABLE IF EXISTS asset_palettes; DROP TABLE IF EXISTS asset_meta"); err != nil {
		logging.LogErrorf("reset rebuildable asset meta index failed: %s", err)
	}
}

func normalizedAssetAddress(meta AssetMeta) (AssetAddress, error) {
	return NewAssetAddress(meta.RootID, meta.Path)
}

// GetProperty 获取属性
func GetProperty(key string) string {
	var val string
	if err := indexDB.QueryRow("SELECT value FROM properties WHERE key = ?", key).Scan(&val); err != nil {
		return ""
	}
	return val
}

// SetProperty 设置属性
func SetProperty(key, value string) error {
	_, err := indexDB.Exec("INSERT OR REPLACE INTO properties (key, value) VALUES (?, ?)", key, value)
	return err
}

// RebuildIndex 重建索引
func RebuildIndex(assets []AssetMeta) error {
	tx, err := indexDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 清空表
	if _, err := tx.Exec("DELETE FROM asset_meta"); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM asset_tags"); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM asset_palettes"); err != nil {
		return err
	}

	// 预编译语句
	stmtMeta, err := tx.Prepare(`INSERT INTO asset_meta
		(asset_key, root_id, path, name, source, source_id, annotation, bound_block_id, star, import_time, width, height, file_size)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmtMeta.Close()

	stmtTag, err := tx.Prepare("INSERT INTO asset_tags (asset_key, tag) VALUES (?, ?)")
	if err != nil {
		return err
	}
	defer stmtTag.Close()

	stmtPalette, err := tx.Prepare("INSERT INTO asset_palettes (asset_key, r, g, b, h, s, l, ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmtPalette.Close()

	for _, asset := range assets {
		address, addressErr := normalizedAssetAddress(asset)
		if addressErr != nil {
			logging.LogErrorf("index asset meta [%s] failed: %s", asset.Path, addressErr)
			continue
		}
		assetKey := address.identityKey()
		if _, err := stmtMeta.Exec(assetKey, address.RootID, address.Path, asset.Name, asset.Source, asset.SourceID,
			asset.Annotation, asset.BoundBlockID, asset.Star, asset.ImportTime, asset.Width, asset.Height, asset.FileSize); err != nil {
			logging.LogErrorf("index asset meta [%s] failed: %s", asset.Path, err)
			continue
		}

		for _, tag := range asset.Tags {
			if _, err := stmtTag.Exec(assetKey, tag); err != nil {
				continue
			}
		}

		for _, p := range asset.Palettes {
			if _, err := stmtPalette.Exec(assetKey, p.Color[0], p.Color[1], p.Color[2], p.H, p.S, p.L, p.Ratio); err != nil {
				continue
			}
		}
	}

	return tx.Commit()
}

// UpdateIndexAsset 更新单个素材索引
func UpdateIndexAsset(asset AssetMeta) error {
	address, err := normalizedAssetAddress(asset)
	if err != nil {
		return err
	}
	assetKey := address.identityKey()
	tx, err := indexDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 删除旧数据
	tx.Exec("DELETE FROM asset_meta WHERE asset_key = ?", assetKey)
	tx.Exec("DELETE FROM asset_tags WHERE asset_key = ?", assetKey)
	tx.Exec("DELETE FROM asset_palettes WHERE asset_key = ?", assetKey)

	// 插入新数据
	if _, err := tx.Exec(`INSERT INTO asset_meta
		(asset_key, root_id, path, name, source, source_id, annotation, bound_block_id, star, import_time, width, height, file_size)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, assetKey, address.RootID, address.Path, asset.Name, asset.Source,
		asset.SourceID, asset.Annotation, asset.BoundBlockID, asset.Star, asset.ImportTime, asset.Width, asset.Height, asset.FileSize); err != nil {
		return err
	}

	for _, tag := range asset.Tags {
		tx.Exec("INSERT INTO asset_tags (asset_key, tag) VALUES (?, ?)", assetKey, tag)
	}

	for _, p := range asset.Palettes {
		tx.Exec("INSERT INTO asset_palettes (asset_key, r, g, b, h, s, l, ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			assetKey, p.Color[0], p.Color[1], p.Color[2], p.H, p.S, p.L, p.Ratio)
	}

	return tx.Commit()
}

// RemoveIndexAsset 删除单个素材索引
func RemoveIndexAsset(path string) error {
	address, err := NewAssetAddress(LegacyDataRootID, path)
	if err != nil {
		return err
	}
	return RemoveIndexAssetAt(address)
}

// RemoveIndexAssetAt 删除一个根地址的可重建索引。
func RemoveIndexAssetAt(address AssetAddress) error {
	normalized, err := NewAssetAddress(address.RootID, address.Path)
	if err != nil {
		return err
	}
	assetKey := normalized.identityKey()
	tx, err := indexDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tx.Exec("DELETE FROM asset_meta WHERE asset_key = ?", assetKey)
	tx.Exec("DELETE FROM asset_tags WHERE asset_key = ?", assetKey)
	tx.Exec("DELETE FROM asset_palettes WHERE asset_key = ?", assetKey)

	return tx.Commit()
}

// BatchUpdateIndexAssets 批量更新/插入素材索引 (事务优化)
func BatchUpdateIndexAssets(assets []AssetMeta) error {
	if len(assets) == 0 {
		return nil
	}

	tx, err := indexDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 预编译语句
	stmtDelMeta, err := tx.Prepare("DELETE FROM asset_meta WHERE asset_key = ?")
	if err != nil {
		return err
	}
	defer stmtDelMeta.Close()

	stmtDelTags, err := tx.Prepare("DELETE FROM asset_tags WHERE asset_key = ?")
	if err != nil {
		return err
	}
	defer stmtDelTags.Close()

	stmtDelPalette, err := tx.Prepare("DELETE FROM asset_palettes WHERE asset_key = ?")
	if err != nil {
		return err
	}
	defer stmtDelPalette.Close()

	stmtMeta, err := tx.Prepare(`INSERT INTO asset_meta
		(asset_key, root_id, path, name, source, source_id, annotation, bound_block_id, star, import_time, width, height, file_size)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmtMeta.Close()

	stmtTag, err := tx.Prepare("INSERT INTO asset_tags (asset_key, tag) VALUES (?, ?)")
	if err != nil {
		return err
	}
	defer stmtTag.Close()

	stmtPalette, err := tx.Prepare("INSERT INTO asset_palettes (asset_key, r, g, b, h, s, l, ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmtPalette.Close()

	for _, asset := range assets {
		address, addressErr := normalizedAssetAddress(asset)
		if addressErr != nil {
			logging.LogErrorf("batch index asset [%s] failed: %s", asset.Path, addressErr)
			continue
		}
		assetKey := address.identityKey()
		// 1. 删除旧数据 (支持更新场景)
		if _, err := stmtDelMeta.Exec(assetKey); err != nil {
			logging.LogErrorf("batch index delete meta [%s] failed: %s", asset.Path, err)
			continue
		}
		stmtDelTags.Exec(assetKey)
		stmtDelPalette.Exec(assetKey)

		// 2. 插入新数据
		if _, err := stmtMeta.Exec(assetKey, address.RootID, address.Path, asset.Name, asset.Source, asset.SourceID,
			asset.Annotation, asset.BoundBlockID, asset.Star, asset.ImportTime, asset.Width, asset.Height, asset.FileSize); err != nil {
			logging.LogErrorf("batch index insert meta [%s] failed: %s", asset.Path, err)
			continue
		}

		for _, tag := range asset.Tags {
			if _, err := stmtTag.Exec(assetKey, tag); err != nil {
				continue
			}
		}

		for _, p := range asset.Palettes {
			if _, err := stmtPalette.Exec(assetKey, p.Color[0], p.Color[1], p.Color[2], p.H, p.S, p.L, p.Ratio); err != nil {
				continue
			}
		}
	}

	return tx.Commit()
}

// SearchAssets 搜索素材
func SearchAssets(keyword string, limit int) ([]string, error) {
	var query string
	var args []interface{}

	if keyword == "" {
		// 优化：无关键字时直接查询 meta 表，无需 JOIN
		query = "SELECT path FROM asset_meta WHERE root_id = ? LIMIT ?"
		args = append(args, LegacyDataRootID, limit)
	} else {
		query = `
			SELECT DISTINCT m.path 
			FROM asset_meta m 
			LEFT JOIN asset_tags t ON m.asset_key = t.asset_key
			WHERE m.root_id = ? AND (m.name LIKE ? OR t.tag LIKE ?)
			LIMIT ?
		`
		likeKey := "%" + keyword + "%"
		args = append(args, LegacyDataRootID, likeKey, likeKey, limit)
	}

	rows, err := indexDB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			continue
		}
		paths = append(paths, path)
	}
	return paths, nil
}

// GetAllPaths 获取所有索引中的路径
func GetAllPaths() (map[string]struct{}, error) {
	rows, err := indexDB.Query("SELECT path FROM asset_meta WHERE root_id = ?", LegacyDataRootID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	paths := make(map[string]struct{})
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			continue
		}
		paths[path] = struct{}{}
	}
	return paths, nil
}

// GetAllTags 获取所有使用中的标签
func GetAllTags() ([]string, error) {
	rows, err := indexDB.Query("SELECT DISTINCT tag FROM asset_tags")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			continue
		}
		tags = append(tags, tag)
	}
	return tags, nil
}

// GetIndexAsset 从索引表读取单个素材元数据
// 这是前端 API 获取元数据的标准方式
func GetIndexAsset(path string) (AssetMeta, bool) {
	address, err := NewAssetAddress(LegacyDataRootID, path)
	if err != nil {
		return AssetMeta{}, false
	}
	return GetIndexAssetAt(address)
}

// GetIndexAssetAt 从索引读取一个稳定根地址的完整主数据投影。
func GetIndexAssetAt(address AssetAddress) (AssetMeta, bool) {
	if indexDB == nil {
		return AssetMeta{}, false
	}
	normalized, err := NewAssetAddress(address.RootID, address.Path)
	if err != nil {
		return AssetMeta{}, false
	}
	assetKey := normalized.identityKey()
	var meta AssetMeta
	meta.Tags = []string{}

	// 1. 查询主表
	row := indexDB.QueryRow(`
		SELECT root_id, path, name, source, source_id, annotation, bound_block_id,
		       star, import_time, width, height, file_size
		FROM asset_meta WHERE asset_key = ?`, assetKey)

	var name, source, sourceID, annotation, boundBlockID sql.NullString
	var fileSize sql.NullInt64
	err = row.Scan(&meta.RootID, &meta.Path, &name, &source, &sourceID, &annotation, &boundBlockID,
		&meta.Star, &meta.ImportTime, &meta.Width, &meta.Height, &fileSize)
	if err != nil {
		return AssetMeta{}, false
	}
	if name.Valid {
		meta.Name = name.String
	}
	if source.Valid {
		meta.Source = source.String
	}
	if sourceID.Valid {
		meta.SourceID = sourceID.String
	}
	if annotation.Valid {
		meta.Annotation = annotation.String
	}
	if boundBlockID.Valid {
		meta.BoundBlockID = boundBlockID.String
	}
	if fileSize.Valid {
		meta.FileSize = fileSize.Int64
	}

	// 2. 查询标签
	tagRows, err := indexDB.Query("SELECT tag FROM asset_tags WHERE asset_key = ? ORDER BY tag COLLATE NOCASE", assetKey)
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tag string
			if tagRows.Scan(&tag) == nil {
				meta.Tags = append(meta.Tags, tag)
			}
		}
	}

	// 3. 查询调色板
	paletteRows, err := indexDB.Query(`SELECT r, g, b, h, s, l, ratio FROM asset_palettes
		WHERE asset_key = ? ORDER BY ratio DESC, h, s, l`, assetKey)
	if err == nil {
		defer paletteRows.Close()
		for paletteRows.Next() {
			var p Palette
			if paletteRows.Scan(&p.Color[0], &p.Color[1], &p.Color[2], &p.H, &p.S, &p.L, &p.Ratio) == nil {
				meta.Palettes = append(meta.Palettes, p)
			}
		}
	}

	return meta, true
}

// GetIndexAssets 从索引表批量读取素材元数据
func GetIndexAssets(paths []string) []AssetMeta {
	if len(paths) == 0 {
		return nil
	}

	var results []AssetMeta
	for _, path := range paths {
		if meta, ok := GetIndexAsset(path); ok {
			results = append(results, meta)
		}
	}
	return results
}

// GetIndexAssetsAt 以输入顺序批量读取稳定根地址，缺失项不会产生占位记录。
func GetIndexAssetsAt(addresses []AssetAddress) []AssetMeta {
	results := make([]AssetMeta, 0, len(addresses))
	for _, address := range addresses {
		if meta, ok := GetIndexAssetAt(address); ok {
			results = append(results, meta)
		}
	}
	return results
}

// PaletteSearch 描述必须由同一个调色板色块满足的 RGB/HSL 条件。
type PaletteSearch struct {
	Color     *[3]int `json:"color,omitempty"`
	Tolerance int     `json:"tolerance,omitempty"`
	MinRatio  float64 `json:"minRatio,omitempty"`
	MinH      *int    `json:"minH,omitempty"`
	MaxH      *int    `json:"maxH,omitempty"`
	MinS      *int    `json:"minS,omitempty"`
	MaxS      *int    `json:"maxS,omitempty"`
	MinL      *int    `json:"minL,omitempty"`
	MaxL      *int    `json:"maxL,omitempty"`
}

// SearchRequest S-Forge 素材高级搜索请求。RootIDs 为空时保持现有 data 素材语义；AllRoots 显式跨根。
type SearchRequest struct {
	Keyword      string         `json:"keyword"`
	RootIDs      []string       `json:"rootIDs,omitempty"`
	AllRoots     bool           `json:"allRoots,omitempty"`
	Tags         []string       `json:"tags,omitempty"`
	MatchAllTags bool           `json:"matchAllTags,omitempty"`
	Palette      *PaletteSearch `json:"palette,omitempty"`
	Limit        int            `json:"limit"`
	Offset       int            `json:"offset"`
	MinWidth     int            `json:"minWidth"`
	MaxWidth     int            `json:"maxWidth"`
	MinHeight    int            `json:"minHeight"`
	MaxHeight    int            `json:"maxHeight"`
	MinSize      int64          `json:"minSize"`
	MaxSize      int64          `json:"maxSize"`
	MinStar      int            `json:"minStar"`
	MaxStar      int            `json:"maxStar"`
	Exts         []string       `json:"exts"`
	OrderBy      string         `json:"orderBy"`
	PathPrefix   string         `json:"pathPrefix,omitempty"`
	PathPrefixes []string       `json:"pathPrefixes,omitempty"`
	Recursive    *bool          `json:"recursive,omitempty"`
}

type searchSQL struct {
	conditions []string
	args       []any
}

func (query *searchSQL) add(condition string, values ...any) {
	query.conditions = append(query.conditions, condition)
	query.args = append(query.args, values...)
}

func (query *searchSQL) whereClause() string {
	if len(query.conditions) == 0 {
		return ""
	}
	return " WHERE " + strings.Join(query.conditions, " AND ")
}

func buildSearchSQL(req SearchRequest) searchSQL {
	query := searchSQL{}
	addRootSearchConditions(&query, req)
	addTextAndTagSearchConditions(&query, req)
	addNumericSearchConditions(&query, req)
	addExtensionSearchConditions(&query, req.Exts)
	addPathScopeSearchConditions(&query, req)
	addPaletteSearchConditions(&query, req.Palette)
	return query
}

func recursiveSearch(req SearchRequest) bool {
	return req.Recursive == nil || *req.Recursive
}

// addPathPrefixSearchCondition restricts results to one root-relative directory subtree.
func addPathPrefixSearchCondition(query *searchSQL, prefix string, recursive bool) {
	prefix = strings.Trim(strings.ReplaceAll(prefix, "\\", "/"), "/")
	if prefix == "." {
		prefix = ""
	}
	if prefix == "" {
		if !recursive {
			query.add(`m.path NOT LIKE ? ESCAPE '\'`, "%/%")
		}
		return
	}
	escaped := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(prefix)
	query.add("m.path LIKE ? ESCAPE '\\'", escaped+"/%")
	if !recursive {
		query.add("m.path NOT LIKE ? ESCAPE '\\'", escaped+"/%/%")
	}
}

// addPathPrefixesSearchCondition adds recursive OR scopes for selected child directories.
func addPathPrefixesSearchCondition(query *searchSQL, prefixes []string) {
	conditions := make([]string, 0, len(prefixes))
	args := make([]any, 0, len(prefixes))
	for _, raw := range prefixes {
		prefix := strings.Trim(strings.ReplaceAll(raw, "\\", "/"), "/")
		if prefix == "" || prefix == "." {
			continue
		}
		escaped := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(prefix)
		conditions = append(conditions, "m.path LIKE ? ESCAPE '\\'")
		args = append(args, escaped+"/%")
	}
	if len(conditions) > 0 {
		query.add("("+strings.Join(conditions, " OR ")+")", args...)
	}
}

// addPathScopeSearchConditions combines the current directory and selected
// child directories as one OR scope. This keeps direct files visible when a
// user excludes one or more child folders from a recursive gallery query.
func addPathScopeSearchConditions(query *searchSQL, req SearchRequest) {
	if len(req.PathPrefixes) == 0 {
		if condition, args, ok := pathPrefixCondition(req.PathPrefix, recursiveSearch(req)); ok {
			query.add(condition, args...)
		}
		return
	}

	conditions := make([]string, 0, len(req.PathPrefixes)+1)
	args := make([]any, 0, len(req.PathPrefixes)+2)
	if condition, prefixArgs, ok := pathPrefixCondition(req.PathPrefix, recursiveSearch(req)); ok {
		conditions = append(conditions, condition)
		args = append(args, prefixArgs...)
	}
	for _, raw := range req.PathPrefixes {
		prefix := normalizeSearchPathPrefix(raw)
		if prefix == "" {
			continue
		}
		escaped := escapeSearchPathPrefix(prefix)
		conditions = append(conditions, "m.path LIKE ? ESCAPE '\\'")
		args = append(args, escaped+"/%")
	}
	if len(conditions) > 0 {
		query.add("("+strings.Join(conditions, " OR ")+")", args...)
	}
}

func pathPrefixCondition(raw string, recursive bool) (string, []any, bool) {
	prefix := normalizeSearchPathPrefix(raw)
	if prefix == "" {
		if !recursive {
			return `m.path NOT LIKE ? ESCAPE '\\'`, []any{"%/%"}, true
		}
		return "", nil, false
	}
	escaped := escapeSearchPathPrefix(prefix)
	if recursive {
		return "m.path LIKE ? ESCAPE '\\'", []any{escaped + "/%"}, true
	}
	return "(m.path LIKE ? ESCAPE '\\' AND m.path NOT LIKE ? ESCAPE '\\')",
		[]any{escaped + "/%", escaped + "/%/%"}, true
}

func normalizeSearchPathPrefix(raw string) string {
	prefix := strings.Trim(strings.ReplaceAll(raw, "\\", "/"), "/")
	if prefix == "." {
		return ""
	}
	return prefix
}

func escapeSearchPathPrefix(prefix string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(prefix)
}

func addRootSearchConditions(query *searchSQL, req SearchRequest) {
	if req.AllRoots {
		return
	}
	roots := uniqueNonEmpty(req.RootIDs)
	if len(roots) == 0 {
		roots = []string{LegacyDataRootID}
	}
	placeholders := make([]string, len(roots))
	for index, rootID := range roots {
		placeholders[index] = "?"
		query.args = append(query.args, rootID)
	}
	query.conditions = append(query.conditions, "m.root_id IN ("+strings.Join(placeholders, ",")+")")
}

func addTextAndTagSearchConditions(query *searchSQL, req SearchRequest) {
	if keyword := strings.TrimSpace(req.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query.add(`(m.name LIKE ? OR m.path LIKE ? OR m.annotation LIKE ? OR
			EXISTS (SELECT 1 FROM asset_tags keyword_tag WHERE keyword_tag.asset_key = m.asset_key AND keyword_tag.tag LIKE ?))`,
			like, like, like, like)
	}
	tags := uniqueNonEmpty(req.Tags)
	if len(tags) == 0 {
		return
	}
	if req.MatchAllTags {
		for _, tag := range tags {
			query.add("EXISTS (SELECT 1 FROM asset_tags required_tag WHERE required_tag.asset_key = m.asset_key AND required_tag.tag = ?)", tag)
		}
		return
	}
	placeholders := make([]string, len(tags))
	for index, tag := range tags {
		placeholders[index] = "?"
		query.args = append(query.args, tag)
	}
	query.conditions = append(query.conditions, `EXISTS (SELECT 1 FROM asset_tags selected_tag
		WHERE selected_tag.asset_key = m.asset_key AND selected_tag.tag IN (`+strings.Join(placeholders, ",")+"))")
}

func addNumericSearchConditions(query *searchSQL, req SearchRequest) {
	checks := []struct {
		condition string
		enabled   bool
		value     any
	}{
		{"m.width >= ?", req.MinWidth > 0, req.MinWidth}, {"m.width <= ?", req.MaxWidth > 0, req.MaxWidth},
		{"m.height >= ?", req.MinHeight > 0, req.MinHeight}, {"m.height <= ?", req.MaxHeight > 0, req.MaxHeight},
		{"m.file_size >= ?", req.MinSize > 0, req.MinSize}, {"m.file_size <= ?", req.MaxSize > 0, req.MaxSize},
		{"m.star >= ?", req.MinStar > 0, req.MinStar}, {"m.star <= ?", req.MaxStar > 0 && req.MaxStar < 5, req.MaxStar},
	}
	for _, check := range checks {
		if check.enabled {
			query.add(check.condition, check.value)
		}
	}
}

func addExtensionSearchConditions(query *searchSQL, extensions []string) {
	valid := []string{}
	for _, extension := range uniqueNonEmpty(extensions) {
		extension = strings.ToLower(strings.TrimPrefix(extension, "."))
		if extension != "" && strings.IndexFunc(extension, func(r rune) bool {
			return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
		}) == -1 {
			valid = append(valid, extension)
		}
	}
	if len(valid) == 0 {
		return
	}
	conditions := make([]string, len(valid))
	for index, extension := range valid {
		conditions[index] = "LOWER(m.path) LIKE ?"
		query.args = append(query.args, "%."+extension)
	}
	query.conditions = append(query.conditions, "("+strings.Join(conditions, " OR ")+")")
}

func addPaletteSearchConditions(query *searchSQL, palette *PaletteSearch) {
	if palette == nil {
		return
	}
	conditions := []string{"p.asset_key = m.asset_key"}
	values := []any{}
	if palette.MinRatio > 0 {
		conditions = append(conditions, "p.ratio >= ?")
		values = append(values, palette.MinRatio)
	}
	if palette.Color != nil {
		tolerance := palette.Tolerance
		if tolerance < 0 {
			tolerance = 0
		}
		if tolerance > 442 {
			tolerance = 442
		}
		conditions = append(conditions, "((p.r - ?) * (p.r - ?) + (p.g - ?) * (p.g - ?) + (p.b - ?) * (p.b - ?)) <= ?")
		values = append(values, palette.Color[0], palette.Color[0], palette.Color[1], palette.Color[1],
			palette.Color[2], palette.Color[2], tolerance*tolerance)
	}
	addHSLRange(&conditions, &values, "p.h", palette.MinH, palette.MaxH, true)
	addHSLRange(&conditions, &values, "p.s", palette.MinS, palette.MaxS, false)
	addHSLRange(&conditions, &values, "p.l", palette.MinL, palette.MaxL, false)
	if len(conditions) > 1 {
		query.add("EXISTS (SELECT 1 FROM asset_palettes p WHERE "+strings.Join(conditions, " AND ")+")", values...)
	}
}

func addHSLRange(conditions *[]string, values *[]any, column string, minimum, maximum *int, circular bool) {
	if minimum != nil && maximum != nil && circular && *minimum > *maximum {
		*conditions = append(*conditions, "("+column+" >= ? OR "+column+" <= ?)")
		*values = append(*values, *minimum, *maximum)
		return
	}
	if minimum != nil {
		*conditions = append(*conditions, column+" >= ?")
		*values = append(*values, *minimum)
	}
	if maximum != nil {
		*conditions = append(*conditions, column+" <= ?")
		*values = append(*values, *maximum)
	}
}

func uniqueNonEmpty(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

func searchOrderClause(orderBy string) string {
	switch orderBy {
	case "name":
		return " ORDER BY m.name COLLATE NOCASE ASC, m.asset_key"
	case "size":
		return " ORDER BY m.file_size DESC, m.asset_key"
	case "resolution":
		return " ORDER BY m.width * m.height DESC, m.asset_key"
	case "star":
		return " ORDER BY m.star DESC, m.asset_key"
	default:
		return " ORDER BY m.import_time DESC, m.asset_key"
	}
}

// SearchAssetsAdvanced 通过标签和调色板索引执行分页搜索，并返回完整元数据投影。
func SearchAssetsAdvanced(req SearchRequest) ([]AssetMeta, int, error) {
	if indexDB == nil {
		return nil, 0, nil
	}
	if req.Limit <= 0 {
		req.Limit = 200
	} else if req.Limit > 1000 {
		req.Limit = 1000
	}
	if req.Offset < 0 {
		req.Offset = 0
	}
	query := buildSearchSQL(req)
	where := query.whereClause()
	var totalCount int
	if err := indexDB.QueryRow("SELECT COUNT(*) FROM asset_meta m"+where, query.args...).Scan(&totalCount); err != nil {
		return nil, 0, err
	}
	dataArgs := append(append([]any{}, query.args...), req.Limit, req.Offset)
	rows, err := indexDB.Query("SELECT m.root_id, m.path FROM asset_meta m"+where+searchOrderClause(req.OrderBy)+
		" LIMIT ? OFFSET ?", dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	addresses := []AssetAddress{}
	for rows.Next() {
		var address AssetAddress
		if scanErr := rows.Scan(&address.RootID, &address.Path); scanErr != nil {
			_ = rows.Close()
			return nil, 0, scanErr
		}
		addresses = append(addresses, address)
	}
	if err = rows.Close(); err != nil {
		return nil, 0, err
	}
	return GetIndexAssetsAt(addresses), totalCount, nil
}
