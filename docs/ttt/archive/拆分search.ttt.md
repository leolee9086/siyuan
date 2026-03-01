# 拆分方案：search.ts (917行)

> 文件路径：`app/src/mobile/menu/search.ts`
> 相关规程：`docs/规程/代码质量/超长文件拆分.procedure.md`

## 文件结构分析

| 行范围 | 函数 | 行数 | 导出 | 职责 |
|--------|------|------|------|------|
| 1-37 | imports | 37 | - | 导入 |
| 39-101 | replace() | 63 | - | 替换操作 |
| 103-158 | updateConfig() | 56 | - | 更新搜索配置 |
| 160-254 | onRecentBlocks() | 95 | - | 渲染搜索结果列表 |
| 256-308 | updateSearchResult() | 53 | export | 更新搜索结果（含分页） |
| 310-696 | initSearchEvent() | 387 | - | 初始化搜索事件（极长，主要瓶颈） |
| 698-832 | popSearch() | 135 | export | 弹出搜索面板（含HTML模板） |
| 834-867 | goAsset() | 34 | - | 跳转资源搜索 |
| 869-878 | goUnRef() | 10 | export | 跳转未引用搜索 |
| 880-916 | getUnRefListMobile() | 37 | - | 获取未引用列表 |

## 核心问题

- `initSearchEvent()` 占387行，是文件超长的主因，包含一个巨大的click事件委托
- `popSearch()` 135行，大部分是HTML模板字符串
- 多个内部函数仅被initSearchEvent使用

## 拆分方案

### 目标文件结构

```
app/src/mobile/menu/
├── search.ts                ← 主文件：popSearch + updateSearchResult + goUnRef (~250行)
├── search.event.ts          ← initSearchEvent中的click事件处理分支 (~300行)
├── search.render.ts         ← onRecentBlocks + replace + updateConfig (~220行)
└── search.asset.ts          ← goAsset + getUnRefListMobile (~80行，可合并)
```

考虑到asset文件过小，合并方案：

```
app/src/mobile/menu/
├── search.ts                ← 主文件：popSearch, updateSearchResult, goUnRef, goAsset, getUnRefListMobile (~300行)
├── search.event.ts          ← initSearchEvent的click事件处理 (~300行)
└── search.render.ts         ← onRecentBlocks, replace, updateConfig (~220行)
```

### 拆分细节

1. `search.render.ts` (~220行)
   - replace()
   - updateConfig()
   - onRecentBlocks()

2. `search.event.ts` (~300行)
   - initSearchEvent() 中的click事件委托逻辑
   - 各type分支处理函数

3. `search.ts` (~300行)
   - toolbarSearchTimeout变量
   - updateSearchResult()（保持导出）
   - popSearch()（保持导出）
   - goUnRef()（保持导出）
   - goAsset()
   - getUnRefListMobile()

### 拆分顺序

1. 先提取render相关到 `search.render.ts`（最独立）
2. 再拆分initSearchEvent到 `search.event.ts`
3. 最后调整主文件导入

## 完成标志

- 三个文件均不超过300行
- updateSearchResult, popSearch, goUnRef 导出签名不变
- 构建通过
