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

### Phase 1：基础设施 ✅ 已完成

- [x] 创建 `assetmeta` 包 (`kernel/assetmeta/`)
- [x] 实现 JSON 数据源读写 (`model.go`: `LoadAsset`, `SaveAsset`, `RemoveAsset`)
- [x] 实现 SQLite 索引管理 (`index.go`: 完整的表结构和 CRUD)
- [x] 索引重建逻辑 (`RebuildIndex`, `BatchUpdateIndexAssets`)
- [x] 路径安全验证 (`isPathInsideDir`, `ErrPathTraversal`)

### Phase 2：API 层 🔄 进行中

参照 `toread/forEagle/useEagleItem.js` 的接口设计，实现以下 API:

#### 2.1 查询 API
- [ ] `POST /api/s-forge/asset-meta/list` - 分页列表查询
  ```go
  type ListRequest struct {
      Limit   int      `json:"limit"`   // 默认 200
      Offset  int      `json:"offset"`  // 分页偏移
      OrderBy string   `json:"orderBy"` // CREATEDATE, FILESIZE, NAME, RESOLUTION
      Keyword string   `json:"keyword"` // 关键词搜索
      Ext     string   `json:"ext"`     // 文件类型过滤
      Tags    []string `json:"tags"`    // 标签过滤
      Star    int      `json:"star"`    // 星级过滤
  }
  ```
- [ ] `POST /api/s-forge/asset-meta/get` - 获取单个素材
- [ ] `POST /api/s-forge/asset-meta/search` - 高级搜索（支持颜色）

#### 2.2 修改 API  
- [ ] `POST /api/s-forge/asset-meta/set` - 设置/更新单个素材
  ```go
  type SetRequest struct {
      Path       string   `json:"path"`       // 必需
      Name       string   `json:"name"`       // 可选
      Tags       []string `json:"tags"`       // 可选
      Star       int      `json:"star"`       // 可选 0-5
      Annotation string   `json:"annotation"` // 可选
  }
  ```
- [ ] `POST /api/s-forge/asset-meta/batch-set` - 批量设置

#### 2.3 标签 API
- [ ] `GET /api/s-forge/asset-meta/tags` - 获取所有标签（合并思源标签）
- [ ] `POST /api/s-forge/asset-meta/tags/set` - 设置标签颜色

#### 2.4 索引管理
- [ ] `POST /api/s-forge/asset-meta/rebuild-index` - 强制重建索引
- [ ] `GET /api/s-forge/asset-meta/status` - 获取索引状态

### Phase 3：Eagle 导入 📋 详细规划

参照 `toread/forEagle/` 的参考实现，支持两种导入模式：

#### 3.1 Eagle 文件系统结构 (fromEagleFs.js)

```
MyLibrary.library/              # 库根目录 (.library 结尾)
├── metadata.json               # 库元数据 (folders, smartFolders, tagsGroups)
├── tags.json                   # 标签定义 (可选)
└── images/                     # 素材存储目录
    └── <ID>.info/              # 单个素材目录
        ├── metadata.json       # 素材元数据
        └── <ID>.<ext>          # 原始文件
```

#### 3.2 导入适配器接口

```go
// eagle_import.go
type EagleImporter struct{}

// DetectLibrary 检测是否为有效的 Eagle 库
func (e *EagleImporter) DetectLibrary(path string) (bool, error)

// ImportLibrary 导入整个 Eagle 库
func (e *EagleImporter) ImportLibrary(libraryPath string, opts ImportOptions) (*ImportResult, error)

type ImportOptions struct {
    TargetDir    string   // 目标 assets 子目录，默认 "eagle-import"
    CopyFiles    bool     // 是否复制文件，false 表示只导入元数据（外部库模式）
    IncludeTags  []string // 只导入包含这些标签的素材，空表示全部
    ExcludeTags  []string // 排除包含这些标签的素材
    SyncMode     bool     // 同步模式：保持与 Eagle 库的关联
}

type ImportResult struct {
    TotalCount   int
    SuccessCount int
    FailedCount  int
    FailedItems  []FailedItem
}
```

#### 3.3 素材元数据映射 (useEagleItem.js)

| Eagle 字段 | 我们的字段 | 说明 |
|-----------|-----------|------|
| id | sourceId | Eagle 原始 ID |
| name | name | 显示名称 |
| tags | tags | 标签列表 |
| star | star | 星级 0-5 |
| annotation | annotation | 注释 |
| width/height | width/height | 图片尺寸 |
| palettes | palettes | 调色板 (RGB + ratio) |
| folders | (映射为标签) | Eagle 文件夹转为标签前缀 |
| url | (存入 annotation) | 来源 URL |
| bTime | importTime | 创建时间 |

#### 3.4 API 端点

- [ ] `POST /api/s-forge/asset-meta/import/eagle/detect` - 检测 Eagle 库
  ```go
  // Request
  type DetectRequest struct {
      Path string `json:"path"` // .library 目录路径
  }
  // Response
  type DetectResponse struct {
      Valid       bool   `json:"valid"`
      Name        string `json:"name"`        // 库名称
      ItemCount   int    `json:"itemCount"`   // 素材数量
      FolderCount int    `json:"folderCount"` // 文件夹数量
      TagCount    int    `json:"tagCount"`    // 标签数量
  }
  ```

- [ ] `POST /api/s-forge/asset-meta/import/eagle/start` - 开始导入
- [ ] `GET /api/s-forge/asset-meta/import/status` - 导入进度查询

#### 3.5 实现步骤

1. **库验证** (`detect`)
   - 检查路径是否以 `.library` 结尾
   - 读取 `metadata.json` 验证格式
   - 统计 `images/` 下的 `.info` 目录数量

2. **标签导入** (`importTags`)
   - 读取 `tags.json` 和 `metadata.json` 中的 `tagsGroups`
   - 合并到我们的 `tags.json`

3. **文件夹映射** (`mapFolders`)
   - 解析 `metadata.json` 中的 `folders` 树结构
   - 转换为标签前缀（如 `eagle/设计/图标`）

4. **素材导入** (`importItems`)
   - 遍历 `images/*.info/` 目录
   - 读取每个 `metadata.json`
   - 复制原始文件到 `assets/eagle-import/`
   - 创建我们的元数据 JSON
   - 批量更新索引

### Phase 4：前端集成 📋 待开始

- [ ] 集成现有视图组件
- [ ] 标签筛选 UI
- [ ] 元数据编辑面板
- [ ] Eagle 导入向导 UI

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
| 数据源 | `data/storage/s-forge-asset-meta/assets/*.json` | 同步，每素材一个 JSON |
| 标签 | `data/storage/s-forge-asset-meta/tags.json` | 同步 |
| 索引 | `temp/s-forge-asset-meta.db` | 不同步，可重建 |

**已实现源文件**:
| 文件 | 行数 | 说明 |
|------|------|------|
| `model.go` | 266 | 数据模型 + 文件读写 + 路径安全验证 |
| `service.go` | 437 | 服务层 + 文件变更处理 + 调色板提取集成 |
| `index.go` | 392 | SQLite 索引管理 |
| `mmcq.go` | 482 | MMCQ 色彩量化算法 |

### 7. 色彩分析 (MMCQ) ✅ 已完成

Go 版本的 MMCQ (Modified Median Cut Quantization) 算法已实现。

**实现文件**: `kernel/assetmeta/mmcq.go` (482 行)

**核心实现**：
1. **降采样**：图像自动缩放到 64×64 最大边长（最近邻采样）
2. **量化**：5 位量化 (32³ = 32768 个直方图桶)
3. **两阶段切割**：
   - 阶段 1：按像素数量切割（目标 75% 颜色数）
   - 阶段 2：按体积×像素数切割（剩余 25%）
4. **颜色空间转换**：RGB → HSL（用于颜色相似度搜索）

**API 接口**：
```go
// 提取并存储调色板
palettes, err := service.ExtractAndStorePalette("assets/xxx.png", 8)

// 仅提取不存储
palettes, err := service.ExtractPaletteOnly("assets/xxx.png", 8)

// 底层函数
palettes, err := ExtractPaletteFromImage(absPath, colorCount)
palettes := ExtractPaletteFromRGBA(rgbaImage, colorCount)
```

**数据结构**：
```go
type Palette struct {
    Color [3]int  `json:"color"` // RGB
    Ratio float64 `json:"ratio"` // 占比 0-1
    H, S, L int   // HSL (用于颜色搜索索引)
}
```

**用途**：
- 为没有调色板的导入素材补全信息
- 为新添加的素材自动生成调色板
- 支持按颜色筛选素材

### 9. 标签 (Tag) 系统协调

思源笔记的 Tag 是隐式的（跟随文档/区块），没有独立的 Tag 数据库表。素材管理系统的 Tag 策略如下：

### 9. 标签 (Tag) 系统协调

利用思源 Tag 系统隐式、开放的特性（无严格 Schema），我们采取 **深度融合** 策略，将素材 Tag 视为思源标签生态的一部分。

1.  **逻辑统一**：在用户视角，素材 Tag 和笔记 Tag 同属于一个标签池。只要被素材 **或者** 笔记引用，该 Tag 即视为 **"存在"**。仅当没有任何笔记且没有任何素材使用某 Tag 时，该 Tag 才视为 **"不存在"**（删除）。
2.  **数据互补**：
    - 笔记标签：来自思源数据库（`spans` 表）。
    - 素材标签：来自素材索引（`s-forge-asset-meta.db`）。
    - **融合展示**：在前端展示时，将两者的标签集合并。
3.  **双向互通**：
    - **搜索**：搜索某个 Tag 时，API 并行查询思源和素材库，聚合返回结果。
    - **补全**：打标签时，提供所有已知标签（笔记+素材）的自动补全。
    - **无隔离**：不再强制使用命名空间前缀（虽仍允许用户自行规划），鼓励标签复用。

### 10. 元数据绑定 (Block Binding)

支持将素材的描述/元数据直接绑定到思源的某个区块（Block）。
- **字段**：`AssetMeta` 增加 `BoundBlockID` 字段。
- **机制**：
    - 如果设置了 `BoundBlockID`，则素材的 `Annotation` (描述) 视为该 Block 的内容。
    - 在素材管理界面修改描述时，同步更新对应的 Block。
    - 允许复用已有的文档块作为素材说明，无需重复编写。


### 8. 颜色相似查询实现

为了在百万级素材中实现高效且符合视觉感知的颜色查找，采用 **HSV 空间粗筛 + CIEDE2000 精排** 的策略。RGB 空间非线性，不适合直接做相似度度量。

**SQLite 存储结构**：
```sql
-- 存储 RGB 及转换后的 HSL/HSV，便于不同维度的筛选
CREATE TABLE asset_palettes (
    path TEXT,
    r INTEGER, g INTEGER, b INTEGER,
    h INTEGER, -- Hue: 0-360
    s INTEGER, -- Saturation: 0-100
    l INTEGER, -- Lightness: 0-100 (亦可存 V)
    ratio REAL,
    FOREIGN KEY(path) REFERENCES asset_meta(path)
);
-- 针对 Hue 建立索引，因为色相是颜色查找的核心
CREATE INDEX idx_palette_h ON asset_palettes(h);
CREATE INDEX idx_palette_sl ON asset_palettes(s, l);
```

**粗筛算法 (SQL 层)**：
1.  **颜色转换**：将目标颜色转为 HSL (H: 0-360, S: 0-100, L: 0-100)。
2.  **Hue 环绕处理**：色相环首尾相接（0度≈360度）。
    - 设阈值 `dH = 30` (可调)。
    - 如果 `target.h < dH`，查询范围为 `[0, target.h + dH] OR [360 - (dH - target.h), 360]`。
    - 如果 `target.h > 360 - dH`，查询范围为 `[target.h - dH, 360] OR [0, dH - (360 - target.h)]`。
    - 否则，范围为 `[target.h - dH, target.h + dH]`。
3.  **饱和度/亮度筛选**：`S` 和 `L` 设定较宽的阈值（如 `+/- 50`），排除掉差异过大的颜色（如黑白灰与鲜艳色的区分）。
4.  **SQL 查询**：
    ```sql
    SELECT path, r, g, b, ratio FROM asset_palettes
    WHERE (h BETWEEN ? AND ? OR h BETWEEN ? AND ?) -- 处理 Hue 环绕
      AND s BETWEEN ? AND ?
      AND l BETWEEN ? AND ?
    ```

**精排算法 (Go 内存层)**：
1.  **CIEDE2000 距离**：计算目标颜色与候选集颜色的 CIEDE2000 色差（比欧氏距离更符合人眼感知）。
2.  **权重计算**：
    - `Score = (1 - CIEDE2000 / 100) * (0.7 + 0.3 * ratio)`
    - 结合颜色相似度和该颜色在图片中的占比。
3.  **Top N**：按分数排序返回前 N 个结果。

