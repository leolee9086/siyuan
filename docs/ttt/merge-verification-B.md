# 合并验证报告 B

验证时间: 2026-02-20T10:34+08:00

## 冲突标记残留检查

搜索 `app/src/*.ts` 中的 `[<]{7}` 模式，结果: **0处残留** ✅

## 文件验证结果

### 1. app/src/menus/util.ts ✅ 通过

Remote改进点:
1. 新增 `showMessage` 导入
2. `exportAsset` 中 fetchPost 回调增加 `response.code === 0` 检查及 `showMessage(window.siyuan.languages.exported)`
3. 新增完整的 `copyAsset` 函数

验证结果: 3项改进全部存在于当前文件中。

### 2. app/src/mobile/index.ts ⚠️ 存在问题

Remote改进点:
- `isInMobileApp()` 检查（Chrome viewport设置和useChrome消息）移入 getLocalStorage 回调内部（语言加载之后）

验证结果: 改进已合入，但存在**重复代码**——相同的 `isInMobileApp()` 检查块同时出现在:
- 第160-166行
- 第210-217行

需要移除其中一处重复。

### 3. app/src/protyle/ui/initUI.ts（含子模块） ⚠️ 存在问题

本地已将 initUI.ts 拆分为子模块: event.ts, dom.ts, loading.ts, padding.ts

Remote改进点:
1. 移除 click 事件处理中的 `setTimeout` 包装（注释: "最新测试无需 setTimeout 了，且会影响移动端键盘弹起故移除"）
2. scrollEvent / mousewheel zoom / click handler / mouseover 等功能

验证结果:
- 改进2: 所有功能均已在子模块中确认存在 ✅
- **改进1: event.ts 第212行仍使用 `setTimeout` 包装，与remote的改进不一致** ❌

差异对比:
- Remote (initUI.ts.remote 第132行): 直接调用，无 setTimeout
- 当前 (event.ts 第212行): 仍包裹在 `setTimeout(() => { ... })` 中

### 4. app/src/protyle/wysiwyg/remove.ts ✅ 通过

Remote改进点:
- setTimeout 内新增 `document.contains(protyle.element)` 守卫检查（remote第255行）

验证结果: 当前文件第251行已包含此检查。

### 5. app/src/card/openCard.ts ✅ 通过

Remote改进点:
1. 第一个 card__action 区域新增跳过按钮 (data-type="-3")
2. 显示答案按钮增加 emoji 图标
3. 跳过逻辑条件改为 `"-3" === type || (["1","2","3","4"].includes(type) && ...)`

验证结果: 3项改进全部确认存在（第110行、第116行、第717行）。

### 6. app/src/search/util.ts（含genSearch子目录） ⚠️ 存在问题

本地已将 genSearch 拆分到 `app/src/search/utils/genSearch/` 子目录

Remote改进点:
1. `openGlobalSearch` 中 position 增加 `noSplitScreenWhenOpenTab` 条件（remote第79行）
2. genSearch HTML 中使用 `escapeAriaLabel`
3. searchOpen 点击处理中 position 增加 `noSplitScreenWhenOpenTab` 条件（remote第596行）

验证结果:
- 改进1: 当前 util.ts 第60行已包含 ✅
- 改进2: genSearchHTML.ts 已包含 ✅
- **改进3: `handleSearchControlClick.ts` 第50行缺少 `!window.siyuan.config.fileTree.noSplitScreenWhenOpenTab &&` 条件** ❌

差异对比:
- Remote第596行: `position: (!window.siyuan.config.fileTree.noSplitScreenWhenOpenTab && (window.siyuan.layout.centerLayout.children.length > 1 || window.innerWidth > 1024)) ? "right" : undefined`
- 当前第50行: `position: (window.siyuan.layout.centerLayout.children.length > 1 || window.innerWidth > 1024) ? "right" : undefined`

## 汇总

| 文件 | 状态 | 问题 |
|------|------|------|
| menus/util.ts | ✅ 通过 | - |
| mobile/index.ts | ⚠️ | isInMobileApp() 检查重复（两处） |
| protyle/ui/event.ts | ⚠️ | setTimeout 未按remote移除 |
| protyle/wysiwyg/remove.ts | ✅ 通过 | - |
| card/openCard.ts | ✅ 通过 | - |
| search handleSearchControlClick.ts | ⚠️ | 缺少 noSplitScreenWhenOpenTab 条件 |

需修复项共3处。
