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
	// 1. asset_meta table
	_, err := indexDB.Exec(`
    CREATE TABLE IF NOT EXISTS asset_meta (
        path TEXT PRIMARY KEY,
        name TEXT,
        source TEXT,
        source_id TEXT,
        star INTEGER DEFAULT 0,
        import_time INTEGER,
        width INTEGER,
        height INTEGER,
        file_size INTEGER
    )`)
	if err != nil {
		logging.LogErrorf("create table [asset_meta] failed: %s", err)
	}

	// 2. asset_tags table (One-to-Many)
	_, err = indexDB.Exec(`
    CREATE TABLE IF NOT EXISTS asset_tags (
        path TEXT,
        tag TEXT,
        PRIMARY KEY(path, tag)
    )`)
	if err != nil {
		logging.LogErrorf("create table [asset_tags] failed: %s", err)
	}
	// Indices for tags
	indexDB.Exec("CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag)")
	indexDB.Exec("CREATE INDEX IF NOT EXISTS idx_asset_tags_path ON asset_tags(path)")

	// 3. asset_palettes table (For color search)
	// 存储 RGB 及转换后的 HSL/HSV
	_, err = indexDB.Exec(`
    CREATE TABLE IF NOT EXISTS asset_palettes (
        path TEXT,
        r INTEGER, g INTEGER, b INTEGER,
        h INTEGER, -- Hue: 0-360
        s INTEGER, -- Saturation: 0-100
        l INTEGER, -- Lightness: 0-100
        ratio REAL,
        FOREIGN KEY(path) REFERENCES asset_meta(path)
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
	stmtMeta, err := tx.Prepare("INSERT INTO asset_meta (path, name, source, source_id, star, import_time, width, height, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmtMeta.Close()

	stmtTag, err := tx.Prepare("INSERT INTO asset_tags (path, tag) VALUES (?, ?)")
	if err != nil {
		return err
	}
	defer stmtTag.Close()

	stmtPalette, err := tx.Prepare("INSERT INTO asset_palettes (path, r, g, b, h, s, l, ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmtPalette.Close()

	for _, asset := range assets {
		if _, err := stmtMeta.Exec(asset.Path, asset.Name, asset.Source, asset.SourceID, asset.Star, asset.ImportTime, asset.Width, asset.Height, asset.FileSize); err != nil {
			logging.LogErrorf("index asset meta [%s] failed: %s", asset.Path, err)
			continue
		}

		for _, tag := range asset.Tags {
			if _, err := stmtTag.Exec(asset.Path, tag); err != nil {
				continue
			}
		}

		for _, p := range asset.Palettes {
			if _, err := stmtPalette.Exec(asset.Path, p.Color[0], p.Color[1], p.Color[2], p.H, p.S, p.L, p.Ratio); err != nil {
				continue
			}
		}
	}

	return tx.Commit()
}

// UpdateIndexAsset 更新单个素材索引
func UpdateIndexAsset(asset AssetMeta) error {
	tx, err := indexDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 删除旧数据
	tx.Exec("DELETE FROM asset_meta WHERE path = ?", asset.Path)
	tx.Exec("DELETE FROM asset_tags WHERE path = ?", asset.Path)
	tx.Exec("DELETE FROM asset_palettes WHERE path = ?", asset.Path)

	// 插入新数据
	if _, err := tx.Exec("INSERT INTO asset_meta (path, name, source, source_id, star, import_time, width, height, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		asset.Path, asset.Name, asset.Source, asset.SourceID, asset.Star, asset.ImportTime, asset.Width, asset.Height, asset.FileSize); err != nil {
		return err
	}

	for _, tag := range asset.Tags {
		tx.Exec("INSERT INTO asset_tags (path, tag) VALUES (?, ?)", asset.Path, tag)
	}

	for _, p := range asset.Palettes {
		tx.Exec("INSERT INTO asset_palettes (path, r, g, b, h, s, l, ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			asset.Path, p.Color[0], p.Color[1], p.Color[2], p.H, p.S, p.L, p.Ratio)
	}

	return tx.Commit()
}

// RemoveIndexAsset 删除单个素材索引
func RemoveIndexAsset(path string) error {
	tx, err := indexDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tx.Exec("DELETE FROM asset_meta WHERE path = ?", path)
	tx.Exec("DELETE FROM asset_tags WHERE path = ?", path)
	tx.Exec("DELETE FROM asset_palettes WHERE path = ?", path)

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
	stmtDelMeta, err := tx.Prepare("DELETE FROM asset_meta WHERE path = ?")
	if err != nil {
		return err
	}
	defer stmtDelMeta.Close()

	stmtDelTags, err := tx.Prepare("DELETE FROM asset_tags WHERE path = ?")
	if err != nil {
		return err
	}
	defer stmtDelTags.Close()

	stmtDelPalette, err := tx.Prepare("DELETE FROM asset_palettes WHERE path = ?")
	if err != nil {
		return err
	}
	defer stmtDelPalette.Close()

	stmtMeta, err := tx.Prepare("INSERT INTO asset_meta (path, name, source, source_id, star, import_time, width, height, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmtMeta.Close()

	stmtTag, err := tx.Prepare("INSERT INTO asset_tags (path, tag) VALUES (?, ?)")
	if err != nil {
		return err
	}
	defer stmtTag.Close()

	stmtPalette, err := tx.Prepare("INSERT INTO asset_palettes (path, r, g, b, h, s, l, ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmtPalette.Close()

	for _, asset := range assets {
		// 1. 删除旧数据 (支持更新场景)
		if _, err := stmtDelMeta.Exec(asset.Path); err != nil {
			logging.LogErrorf("batch index delete meta [%s] failed: %s", asset.Path, err)
			continue
		}
		stmtDelTags.Exec(asset.Path)
		stmtDelPalette.Exec(asset.Path)

		// 2. 插入新数据
		if _, err := stmtMeta.Exec(asset.Path, asset.Name, asset.Source, asset.SourceID, asset.Star, asset.ImportTime, asset.Width, asset.Height, asset.FileSize); err != nil {
			logging.LogErrorf("batch index insert meta [%s] failed: %s", asset.Path, err)
			continue
		}

		for _, tag := range asset.Tags {
			if _, err := stmtTag.Exec(asset.Path, tag); err != nil {
				continue
			}
		}

		for _, p := range asset.Palettes {
			if _, err := stmtPalette.Exec(asset.Path, p.Color[0], p.Color[1], p.Color[2], p.H, p.S, p.L, p.Ratio); err != nil {
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
		query = "SELECT path FROM asset_meta LIMIT ?"
		args = append(args, limit)
	} else {
		query = `
			SELECT DISTINCT m.path 
			FROM asset_meta m 
			LEFT JOIN asset_tags t ON m.path = t.path 
			WHERE m.name LIKE ? OR t.tag LIKE ? 
			LIMIT ?
		`
		likeKey := "%" + keyword + "%"
		args = append(args, likeKey, likeKey, limit)
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
	rows, err := indexDB.Query("SELECT path FROM asset_meta")
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
	var meta AssetMeta

	// 1. 查询主表
	row := indexDB.QueryRow(`
		SELECT path, name, source, source_id, star, import_time, width, height, file_size 
		FROM asset_meta WHERE path = ?`, path)

	var sourceID sql.NullString
	var fileSize sql.NullInt64
	err := row.Scan(&meta.Path, &meta.Name, &meta.Source, &sourceID,
		&meta.Star, &meta.ImportTime, &meta.Width, &meta.Height, &fileSize)
	if err != nil {
		return AssetMeta{}, false
	}
	if sourceID.Valid {
		meta.SourceID = sourceID.String
	}
	if fileSize.Valid {
		meta.FileSize = fileSize.Int64
	}

	// 2. 查询标签
	tagRows, err := indexDB.Query("SELECT tag FROM asset_tags WHERE path = ?", path)
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
	paletteRows, err := indexDB.Query("SELECT r, g, b, h, s, l, ratio FROM asset_palettes WHERE path = ?", path)
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

// SearchRequest S-Forge 素材高级搜索请求
type SearchRequest struct {
	Keyword   string   `json:"keyword"`   // 关键词搜索
	Limit     int      `json:"limit"`     // 每页数量，默认 200
	Offset    int      `json:"offset"`    // 分页偏移
	MinWidth  int      `json:"minWidth"`  // 最小宽度
	MaxWidth  int      `json:"maxWidth"`  // 最大宽度
	MinHeight int      `json:"minHeight"` // 最小高度
	MaxHeight int      `json:"maxHeight"` // 最大高度
	MinSize   int64    `json:"minSize"`   // 最小文件大小 (字节)
	MaxSize   int64    `json:"maxSize"`   // 最大文件大小 (字节)
	MinStar   int      `json:"minStar"`   // 最小星级 (0-5)
	MaxStar   int      `json:"maxStar"`   // 最大星级 (0-5)
	Exts      []string `json:"exts"`      // 扩展名列表
	OrderBy   string   `json:"orderBy"`   // 排序字段
}

// SearchAssetsAdvanced 高级素材搜索
func SearchAssetsAdvanced(req SearchRequest) ([]AssetMeta, int, error) {
	if indexDB == nil {
		return nil, 0, nil
	}

	// 构建 WHERE 子句
	var conditions []string
	var args []interface{}

	// 关键词搜索 (name 或 path)
	if req.Keyword != "" {
		conditions = append(conditions, "(name LIKE ? OR path LIKE ?)")
		keyword := "%" + req.Keyword + "%"
		args = append(args, keyword, keyword)
	}

	// 尺寸过滤
	if req.MinWidth > 0 {
		conditions = append(conditions, "width >= ?")
		args = append(args, req.MinWidth)
	}
	if req.MaxWidth > 0 {
		conditions = append(conditions, "width <= ?")
		args = append(args, req.MaxWidth)
	}
	if req.MinHeight > 0 {
		conditions = append(conditions, "height >= ?")
		args = append(args, req.MinHeight)
	}
	if req.MaxHeight > 0 {
		conditions = append(conditions, "height <= ?")
		args = append(args, req.MaxHeight)
	}

	// 文件大小过滤
	if req.MinSize > 0 {
		conditions = append(conditions, "file_size >= ?")
		args = append(args, req.MinSize)
	}
	if req.MaxSize > 0 {
		conditions = append(conditions, "file_size <= ?")
		args = append(args, req.MaxSize)
	}

	// 星级过滤
	if req.MinStar > 0 {
		conditions = append(conditions, "star >= ?")
		args = append(args, req.MinStar)
	}
	if req.MaxStar > 0 && req.MaxStar < 5 {
		conditions = append(conditions, "star <= ?")
		args = append(args, req.MaxStar)
	}

	// 扩展名过滤
	if len(req.Exts) > 0 {
		var extConditions []string
		for _, ext := range req.Exts {
			extConditions = append(extConditions, "path LIKE ?")
			args = append(args, "%"+ext)
		}
		conditions = append(conditions, "("+strings.Join(extConditions, " OR ")+")")
	}

	// 构建完整 SQL
	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// 排序
	orderClause := " ORDER BY import_time DESC"
	switch req.OrderBy {
	case "name":
		orderClause = " ORDER BY name ASC"
	case "size":
		orderClause = " ORDER BY file_size DESC"
	case "resolution":
		orderClause = " ORDER BY width * height DESC"
	case "star":
		orderClause = " ORDER BY star DESC"
	}

	// 查询总数
	countSQL := "SELECT COUNT(*) FROM asset_meta" + whereClause
	var totalCount int
	if err := indexDB.QueryRow(countSQL, args...).Scan(&totalCount); err != nil {
		return nil, 0, err
	}

	// 查询数据
	dataSQL := "SELECT path, name, source, star, import_time, width, height, file_size FROM asset_meta" +
		whereClause + orderClause + " LIMIT ? OFFSET ?"
	args = append(args, req.Limit, req.Offset)

	rows, err := indexDB.Query(dataSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []AssetMeta
	for rows.Next() {
		var meta AssetMeta
		var fileSize sql.NullInt64
		err := rows.Scan(&meta.Path, &meta.Name, &meta.Source, &meta.Star, &meta.ImportTime, &meta.Width, &meta.Height, &fileSize)
		if err != nil {
			continue
		}
		if fileSize.Valid {
			meta.FileSize = fileSize.Int64
		}
		results = append(results, meta)
	}

	return results, totalCount, nil
}
