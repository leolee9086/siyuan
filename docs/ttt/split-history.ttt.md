# 拆分方案：history.ts (978行)

> 文件路径：`app/src/history/history.ts`
> 相关规程：`docs/规程/代码质量/超长文件拆分.procedure.md`

## 文件结构分析

| 行范围 | 函数/块 | 行数 | 导出 | 职责 |
|--------|---------|------|------|------|
| 1-21 | imports | 21 | - | 导入 |
| 22 | historyEditor | 1 | - | 模块级变量 |
| 24-111 | renderDoc() | 88 | - | 渲染文档历史列表 |
| 113-276 | renderRepoItem() | 164 | - | 渲染仓库快照条目（含移动端/桌面端分支） |
| 278-323 | renderRepo() | 46 | - | 渲染仓库面板 |
| 325-357 | renderRmNotebook() | 33 | - | 渲染已删除笔记本 |
| 359-500 | openHistory() | 142 | export | 主入口，创建对话框+HTML模板 |
| 502-977 | bindEvent() | 476 | - | 事件绑定（极长，主要瓶颈） |

## 核心问题

- `bindEvent()` 占476行，是文件超长的主因，包含大量click事件分支
- `renderRepoItem()` 164行，含移动端/桌面端两套HTML模板
- `openHistory()` 142行，大部分是HTML模板字符串

## 拆分方案

### 目标文件结构

```
app/src/history/
├── history.ts              ← 主文件：openHistory + historyEditor变量 (~170行)
├── history.render.ts       ← renderDoc, renderRepoItem, renderRepo, renderRmNotebook (~330行)
├── history.docEvent.ts     ← bindEvent中文档历史相关事件处理 (~250行)
└── history.repoEvent.ts    ← bindEvent中仓库快照相关事件处理 (~230行)
```

### 拆分细节

1. `history.render.ts` (~330行)
   - renderDoc()
   - renderRepoItem()
   - renderRepo()
   - renderRmNotebook()

2. `history.docEvent.ts` (~250行)
   - bindEvent中的文档历史tab切换、toggle展开、doc/asset/av预览、分页、rebuildIndex等

3. `history.repoEvent.ts` (~230行)
   - bindEvent中的仓库快照操作：genRepo对话框、genTag对话框、upload/download/rollback、compare、repo分页等

4. `history.ts` (~170行)
   - historyEditor变量
   - openHistory()（保持导出不变）
   - 从拆分文件导入并组装bindEvent

### 拆分顺序

1. 先提取render函数到 `history.render.ts`（最独立）
2. 再拆分bindEvent为doc和repo两部分
3. 最后调整主文件的导入

## 完成标志

- 四个文件均不超过300行
- `openHistory` 导出签名不变
- 构建通过
