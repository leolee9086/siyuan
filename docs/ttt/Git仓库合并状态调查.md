# Git 仓库状态调查报告

调查时间: 2026-02-13 11:40 (UTC+8)

## 1. 当前分支

`multipleAI`

## 2. 工作区状态

**存在未完成的合并操作**，当前处于合并冲突状态。

- 有大量已暂存的修改文件（来自合并的 origin/dev 内容）
- 36 个文件存在合并冲突（both modified），需要手动解决

### 冲突文件列表

| 文件 | 类型 |
|------|------|
| app/package.json | both modified |
| app/pnpm-lock.yaml | both modified |
| app/src/block/Panel.ts | both modified |
| app/src/boot/globalEvent/command/global.ts | both modified |
| app/src/config/about.ts | both modified |
| app/src/config/exportConfig.ts | both modified |
| app/src/config/image.ts | both modified |
| app/src/config/index.ts | both modified |
| app/src/constants.ts | both modified |
| app/src/history/history.ts | both modified |
| app/src/index.ts | both modified |
| app/src/layout/Wnd.ts | both modified |
| app/src/layout/util.ts | both modified |
| app/src/menus/protyle.ts | both modified |
| app/src/mobile/index.ts | both modified |
| app/src/mobile/menu/index.ts | both modified |
| app/src/mobile/settings/about.ts | both modified |
| app/src/mobile/util/keyboardToolbar.ts | both modified |
| app/src/plugin/API.ts | both modified |
| app/src/plugin/index.ts | both modified |
| app/src/protyle/gutter/index.ts | both modified |
| app/src/protyle/render/av/action.ts | both modified |
| app/src/protyle/render/av/cell.ts | both modified |
| app/src/protyle/render/av/render.ts | both modified |
| app/src/protyle/toolbar/index.ts | both modified |
| app/src/protyle/ui/initUI.ts | both modified |
| app/src/protyle/upload/index.ts | both modified |
| app/src/protyle/util/compatibility.ts | both modified |
| app/src/protyle/util/editorCommonEvent.ts | both modified |
| app/src/protyle/wysiwyg/keydown.ts | both modified |
| app/src/protyle/wysiwyg/remove.ts | both modified |
| app/src/search/util.ts | both modified |
| app/src/util/addClearButton.ts | both modified |
| app/src/util/fetch.ts | both modified |
| kernel/go.mod | both modified |
| kernel/model/assets.go | both modified |

## 3. 本地最近 10 次提交

```
7592df9b4 改进设计文档,拆分ghost文档和shell文档
c14c9a215 改进向量索引
8c01a3c93 改进向量索引性能
1df88ec48 优化索引性能
3a7f557a2 改进向量索引性能
5e994d1df 改进向量索引性能
6ca596055 改进向量索引性能
6b4462a87 改进索引性能
ad2179c7e 改进索引性能
a281e2364 改进索引性能
```

## 4. 远程仓库配置

| 名称 | URL | 用途 |
|------|-----|------|
| leolee9086 | https://github.com/leolee9086/siyuan | fetch/push |
| origin | https://github.com/siyuan-note/siyuan.git | fetch/push（上游仓库） |

## 5. 所有分支

### 本地分支
- master
- **multipleAI** (当前)

### 远程分支
- leolee9086/multipleAI
- origin/HEAD → origin/master
- origin/dependabot/go_modules/kernel/github.com/quic-go/quic-go-0.57.0
- origin/dev
- origin/master

## 6. 与 origin/dev 的差异概况

| 方向 | 提交数 | 说明 |
|------|--------|------|
| HEAD..origin/dev（本地落后） | 296 | origin/dev 有 296 个提交不在本地 |
| origin/dev..HEAD（本地领先） | 2160 | 本地有 2160 个提交不在 origin/dev |

### diff 统计（HEAD vs origin/dev）
- 2472 个文件变更
- +39,315 行新增
- -513,892 行删除

### origin/dev 最新提交（前 5 条）
```
32694808f Merge remote-tracking branch 'origin/dev' into dev
e392e2b52 :art: https://github.com/siyuan-note/siyuan/issues/17024
cd3f0640e :memo: Update changelogs
83161400b :bug: cert: Fix IP addresses not being collected properly (#17028)
393e0e88f :bug: Document content not updated after snapshot rollback
```

## 7. 相关规程检查

docs/规程 目录下**不存在**与"git合并"或"分支合并"相关的 .procedure.md 文件。

现有规程目录结构：
- 测试与修复/（3 个规程）
- 代码质量/（5 个规程）
- 后端开发/（1 个规程）
- 文档管理/（3 个规程）
- 性能优化/（3 个规程）

## 8. 关键发现

1. **当前已处于合并冲突状态**：已经执行过 `git merge origin/dev`（或类似操作），但尚未完成，有 36 个文件存在冲突
2. **分支差异巨大**：本地 multipleAI 分支与 origin/dev 之间有大量差异（2160 vs 296 提交），合并复杂度高
3. **缺少合并规程**：没有现成的 git 合并操作规程，后续如需执行合并操作，应先编写规程
4. **可选操作**：可以 `git merge --abort` 取消当前合并，回到合并前状态重新规划
