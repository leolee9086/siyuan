# S-Forge 素材管理系统

## 目标

实现一个增强的素材管理系统，支持：
- 从 Eagle 等外部素材库导入
- 标签管理和筛选
- 百万级素材流畅浏览
- 与思源笔记无缝集成

---

## 架构设计

### 数据存储策略（与思源一致）

```
workspace/
├── data/
│   └── storage/
│       └── s-forge-asset-meta/
│           └── meta.json       # 唯一数据源（同步）
└── temp/
    ├── siyuan.db               # 思源索引
    └── s-forge-asset-meta.db   # 素材索引（不同步，可重建）
```

**设计原则**：
- `meta.json` 是唯一数据源，可同步、可版本控制
- SQLite 索引仅用于加速查询，可随时从 JSON 重建

### meta.json 结构

```json
{
  "version": 1,
  "assets": {
    "assets/xxx.png": {
      "name": "图标设计",
      "tags": ["设计", "图标", "UI"],
      "star": 3,
      "annotation": "从 Eagle 导入",
      "source": "eagle",
      "sourceId": "ABCD1234",
      "importTime": 1234567890,
      "width": 1920,
      "height": 1080
    }
  },
  "tags": {
    "设计": { "color": "#FF6B6B" },
    "图标": { "color": "#4ECDC4" }
  }
}
```

### SQLite 索引表结构

```sql
-- 素材元数据索引
CREATE TABLE asset_meta (
    path TEXT PRIMARY KEY,
    name TEXT,
    source TEXT,
    star INTEGER DEFAULT 0,
    import_time INTEGER,
    width INTEGER,
    height INTEGER,
    file_size INTEGER
);

-- 标签关联（多对多）
CREATE TABLE asset_tags (
    path TEXT,
    tag TEXT,
    PRIMARY KEY(path, tag)
);
CREATE INDEX idx_asset_tags_tag ON asset_tags(tag);
CREATE INDEX idx_asset_tags_path ON asset_tags(path);

-- 标签定义
CREATE TABLE tags (
    name TEXT PRIMARY KEY,
    color TEXT
);
```

---

## 功能模块

### 1. 后端 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/s-forge/asset-meta/list` | POST | 列出素材（分页、筛选） |
| `/api/s-forge/asset-meta/get` | POST | 获取单个素材元数据 |
| `/api/s-forge/asset-meta/set` | POST | 设置素材元数据 |
| `/api/s-forge/asset-meta/batch-set` | POST | 批量设置 |
| `/api/s-forge/asset-meta/tags` | GET | 获取所有标签 |
| `/api/s-forge/asset-meta/rebuild-index` | POST | 重建索引 |
| `/api/s-forge/asset-meta/import/eagle` | POST | 导入 Eagle 库 |

### 2. 导入适配器

```go
type ImportAdapter interface {
    Name() string
    Detect(path string) (bool, error)       // 检测是否为该类型库
    Import(path string, opts ImportOptions) error
}
```

支持的格式：
- [ ] Eagle (.library 目录)
- [ ] 本地文件夹（扫描并导入）
- [ ] 未来：Pinterest、Figma 导出等

### 3. 前端集成

利用哥哥已有的百万级文件视图组件，提供：
- 标签筛选面板
- 网格/列表视图切换
- 拖拽添加标签
- 右键菜单（编辑元数据、删除等）

---

## 实现计划

### Phase 1：基础设施
- [ ] 创建 `assetmeta` 包
- [ ] 实现 JSON 数据源读写
- [ ] 实现 SQLite 索引管理
- [ ] 索引重建逻辑

### Phase 2：API 层
- [ ] 列表/查询 API
- [ ] 设置/批量设置 API
- [ ] 标签管理 API

### Phase 3：Eagle 导入
- [ ] Eagle 格式解析
- [ ] 文件复制逻辑
- [ ] 元数据迁移

### Phase 4：前端集成
- [ ] 集成现有视图组件
- [ ] 标签筛选 UI
- [ ] 元数据编辑面板

---

## 依赖

- 缩略图服务 ✅ 已完成
- 现有 assets 目录结构
- 哥哥的百万级文件视图组件

---

## 备注

- 不修改思源原有表结构，保证数据兼容性
- JSON 作为唯一数据源，索引可随时重建
- Eagle 格式细节见下方

---

## Eagle 文件系统格式详解

### 目录结构

```
MyLibrary.library/              # 库根目录（以 .library 结尾）
├── metadata.json               # 库元数据（文件夹定义、智能文件夹等）
├── tags.json                   # 标签定义（可选）
├── images/                     # 素材存储目录
│   ├── ABCD1234.info/          # 单个素材目录（ID + .info）
│   │   ├── metadata.json       # 素材元数据（与文件同目录）
│   │   ├── ABCD1234.png        # 原始文件（文件名 = ID + 扩展名）
│   │   └── ABCD1234_thumbnail.png  # 缩略图（可选）
│   ├── EFGH5678.info/
│   │   ├── metadata.json
│   │   └── EFGH5678.jpg
│   └── ...
└── images_recycled/            # 回收站
```

**关键点**（来自 `fromEagleFs.js`）：
- 库根目录必须以 `.library` 结尾
- 每个素材的 `metadata.json` 与素材文件在同一目录
- 库级别有可选的 `tags.json` 文件

### 素材 metadata.json 结构

基于 JS API 中的类型定义：

```go
// EagleItemMeta Eagle 素材元数据
type EagleItemMeta struct {
    ID               string    `json:"id"`               // 唯一标识符
    Name             string    `json:"name"`             // 显示名称
    Size             int64     `json:"size"`             // 文件大小（字节）
    BTime            int64     `json:"bTime"`            // 创建时间（毫秒时间戳）
    MTime            int64     `json:"mTime"`            // 修改时间（毫秒时间戳）
    Ext              string    `json:"ext"`              // 文件扩展名（不含点）
    Tags             []string  `json:"tags"`             // 标签列表
    Folders          []string  `json:"folders"`          // 所属文件夹 ID 列表
    IsDeleted        bool      `json:"isDeleted"`        // 是否已删除
    URL              string    `json:"url,omitempty"`    // 来源 URL
    Annotation       string    `json:"annotation"`       // 注释
    ModificationTime int64     `json:"modificationTime"` // 另一个修改时间戳
    Star             int       `json:"star,omitempty"`   // 星级评分 0-5
    NoThumbnail      bool      `json:"noThumbnail"`      // 是否无缩略图
    Width            int       `json:"width,omitempty"`  // 宽度（图片/视频）
    Height           int       `json:"height,omitempty"` // 高度（图片/视频）
    Palettes         []Palette `json:"palettes,omitempty"` // 调色板
    LastModified     int64     `json:"lastModified"`     // 最后修改时间
}

type Palette struct {
    Color [3]int  `json:"color"` // RGB 颜色值
    Ratio float64 `json:"ratio"` // 颜色占比
}
```

### 库 metadata.json 结构

```go
// EagleLibraryMeta Eagle 库元数据
type EagleLibraryMeta struct {
    Folders             []EagleFolder       `json:"folders"`             // 文件夹列表
    SmartFolders        []EagleSmartFolder  `json:"smartFolders"`        // 智能文件夹
    QuickAccess         []QuickAccessItem   `json:"quickAccess"`         // 快速访问
    TagsGroups          []TagGroup          `json:"tagsGroups"`          // 标签组
    ModificationTime    int64               `json:"modificationTime"`    // 修改时间
    ApplicationVersion  string              `json:"applicationVersion"`  // Eagle 版本
}

type EagleFolder struct {
    ID               string         `json:"id"`
    Name             string         `json:"name"`
    Description      string         `json:"description"`
    Children         []EagleFolder  `json:"children"`     // 子文件夹（递归）
    ModificationTime int64          `json:"modificationTime"`
    Tags             []string       `json:"tags"`
    IconColor        string         `json:"iconColor,omitempty"`
    Icon             string         `json:"icon,omitempty"`
    Password         string         `json:"password,omitempty"`
    PasswordTips     string         `json:"passwordTips,omitempty"`
    CoverID          string         `json:"coverId,omitempty"`
    OrderBy          string         `json:"orderBy,omitempty"`
    SortIncrease     bool           `json:"sortIncrease,omitempty"`
}

type TagGroup struct {
    ID    string   `json:"id"`
    Name  string   `json:"name"`
    Tags  []string `json:"tags"`
    Color string   `json:"color,omitempty"`
}
```

---

## Go 后端实现

### 关键流程

```go
// 导入 Eagle 库
func ImportEagleLibrary(libraryPath string, opts ImportOptions) error {
    // 1. 验证是否为有效的 Eagle 库
    if !isEagleLibrary(libraryPath) {
        return ErrNotEagleLibrary
    }

    // 2. 读取库元数据
    libMeta, err := readLibraryMeta(libraryPath)
    if err != nil {
        return err
    }

    // 3. 扫描 images/ 目录下所有 .info 文件夹
    imagesDir := filepath.Join(libraryPath, "images")
    entries, _ := os.ReadDir(imagesDir)

    for _, entry := range entries {
        if !entry.IsDir() || !strings.HasSuffix(entry.Name(), ".info") {
            continue
        }

        // 4. 读取每个素材的 metadata.json
        itemMeta, err := readItemMeta(filepath.Join(imagesDir, entry.Name()))
        if err != nil || itemMeta.IsDeleted {
            continue
        }

        // 5. 复制文件到 assets/
        srcFile := filepath.Join(imagesDir, entry.Name(), itemMeta.ID+"."+itemMeta.Ext)
        dstFile := generateAssetPath(itemMeta)
        copyFile(srcFile, dstFile)

        // 6. 记录元数据到我们的 meta.json
        addAssetMeta(dstFile, AssetMeta{
            Name:       itemMeta.Name,
            Tags:       itemMeta.Tags,
            Star:       itemMeta.Star,
            Annotation: itemMeta.Annotation,
            Source:     "eagle",
            SourceID:   itemMeta.ID,
            ImportTime: time.Now().Unix(),
            Width:      itemMeta.Width,
            Height:     itemMeta.Height,
        })
    }

    return nil
}
```

### 文件位置

| 类型 | 路径 | 备注 |
|------|------|------|
| 包目录 | `kernel/assetmeta/` | 素材元数据服务 |
| 数据源 | `data/storage/s-forge-asset-meta/meta.json` | 同步 |
| 索引 | `temp/s-forge-asset-meta.db` | 不同步 |

