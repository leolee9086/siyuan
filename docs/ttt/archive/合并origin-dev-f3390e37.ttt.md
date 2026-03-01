# 合并 siyuan-note/siyuan dev (f3390e37) 到 multipleAI

## 背景

- 当前分支: multipleAI
- 合并来源: dev (https://github.com/siyuan-note/siyuan)
- 合并commit: f3390e37add5e6c24650360e6433f681e09b502b
- 冲突文件: 19个（18个both modified + 1个deleted by us）
- 当前状态: ✅ 已完成
- 规程: docs/规程/版本管理/远程分支合并.procedure.md
- 冲突扫描结果: docs/ttt/conflict-scan-result.md

## 冲突文件清单

### 批次1：包管理文件（2个）
- [x] app/package.json（行95）
- [x] app/pnpm-lock.yaml（13处冲突）

### 批次2：简单冲突A（6个，各1处冲突）
- [x] app/src/boot/onGetConfig.ts（行8）
- [x] app/src/layout/dock/Bookmark.ts（行35）
- [x] app/src/layout/dock/Files.ts（行66）
- [x] app/src/layout/dock/Tag.ts（行34）
- [x] app/src/menus/util.ts（行14）
- [x] app/src/mobile/index.ts（行210）

### 批次3：简单冲突B（5个，各1处冲突）
- [x] app/src/protyle/ui/initUI.ts（行21）
- [x] app/src/protyle/wysiwyg/remove.ts（行173）
- [x] app/src/card/openCard.ts（行110）
- [x] app/src/search/util.ts（行64）
- [x] app/src/protyle/ui/hideElements.ts（行1）

### 批次4：多冲突文件（5个，各2处冲突）
- [x] app/src/config/fileTree.ts（行49, 162）
- [x] app/src/window/init.ts（行1, 135）
- [x] app/src/menus/protyle.ts（行19, 95）
- [x] app/src/protyle/gutter/index.ts（行5, 155）
- [x] app/src/protyle/render/av/asset.ts（行1, 267）

### 特殊处理
- [x] app/src/layout/dock/Outline.ts — deleted by us，保持本地删除（已重构为outline/子目录）

## 合并决策摘要

- package.json：共有依赖取较高版本，双方独有依赖均保留
- pnpm-lock.yaml：接受远程版本后通过pnpm install重新生成
- Outline.ts（deleted by us）：保持本地删除（已重构为outline/子目录）
- 其余17个文件：保留本地模块化重构+采纳远程bugfix和新功能

## 验证结果

- 验证批次A：6/6通过
- 验证批次B：初始3/6通过，修复3处缺失后全部通过
  - mobile/index.ts: isInMobileApp()重复代码已删除
  - event.ts: setTimeout包装已移除（远程bugfix）
  - handleSearchControlClick.ts: 添加noSplitScreenWhenOpenTab条件
- 验证批次C：初始4/6通过，修复2处缺失后全部通过
  - protyle.imgMenu.ts: 添加base64ToURL图片源转换逻辑
  - buildGutterStyleMenu.ts: 添加echarts chartRender调用

## 进度记录

- 2026-02-19 21:17: 扫描确认全部18个文件均有冲突标记，创建ttt
- 2026-02-20 11:09: 全部19个冲突文件解决完毕，验证通过，合并完成

## 失败记录

- search_files搜索`<<<<<<<`时因XML转义问题返回0结果，产生错误结论。改用`[<]{7}`正则后获得正确结果。
- protyle.ts冲突解决首次失败（write_to_file缺少content参数），重新派发后成功
- onGetConfig.ts的.backup/.remote文件不存在（早期处理时未创建备份），改用git show获取
- 验证阶段发现5处远程改进缺失（子模块中未包含），已全部修复
- git commit --no-edit首次执行返回exit code 1，用户自行完成提交

## 规程改进

- 合并规程新增验证步骤：远程改进完整性验证 + 子模块扩展验证
