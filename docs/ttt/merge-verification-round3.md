# 第三轮合并验证报告（multipleAI ← origin/dev）

- 合并commit: `e337f4536`
- merge-base: `f3390e37`
- origin/dev HEAD: `b01d1cae4`
- 验证时间: 2026-02-21T21:34 (UTC+8)

## 基础验证

| 检查项 | 结果 |
|--------|------|
| 冲突标记残留（4个文件） | ✅ 无残留 |
| 未合并文件（git diff --diff-filter=U） | ✅ 为空 |

## 文件级验证

### 1. `app/src/protyle/ui/initUI.ts`

上游commit: `e7b04229c` (:rotating_light:)

| 改进项 | 验证结果 | 说明 |
|--------|----------|------|
| 移除未使用的 `isTouchDevice` 导入 | ✅ 已包含 | 模块化重构后 `isTouchDevice` 仅在 `event.ts` 中导入（实际使用处） |

### 2. `app/src/protyle/gutter/index.ts`

上游commit: `e7b04229c`, `19d9c455a`

| 改进项 | 验证结果 | 说明 |
|--------|----------|------|
| echarts querySelector 单引号→双引号（3处） | ✅ 已包含 | 重构到 `buildGutterStyleMenu.ts`，使用双引号 |
| cellElement fallback: `nodeElement.querySelector("th, td")` | ✅ 已包含 | 重构到 `buildGutterTableMenu.ts:28-29` |

### 3. `app/src/protyle/toolbar/index.ts`

上游commit: `19d9c455a`

| 改进项 | 验证结果 | 说明 |
|--------|----------|------|
| 添加 `hasClosestByTag` 导入 | ✅ 已包含 | 重构到 `renderToolbar.ts:1` |
| render 方法中添加 CAPTION 检查 | ✅ 已包含 | 重构到 `renderToolbar.ts:17-18` |
| `preventScroll` 格式修复（2处） | ✅ 重构等效 | 原 `.focus({preventScroll})` 调用已被重构为 `focusBlock()` 机制 |

### 4. `app/src/menus/protyle.ts`

上游commit（12个）: #17002 和 #17051 相关

#### tableMenu 改进

| 改进项 | 验证结果 | 说明 |
|--------|----------|------|
| Dialog 导入 | ✅ 已包含 | `protyle.ts:32` |
| 表格标题(caption)编辑对话框 | ✅ 已包含 | `protyle.ts:263-320` |
| insertRowAbove 批量插入（bind模式） | ✅ 已包含 | `protyle.ts:470-493` |
| insertRowBelow 批量插入（bind模式） | ✅ 已包含 | `protyle.ts:499-522` |
| insertColumnLeft 批量插入（bind模式） | ✅ 已包含 | `protyle.ts:530-553` |
| insertColumnRight 批量插入（bind模式） | ✅ 已包含 | `protyle.ts:561-582` |

#### contentMenu caption 守卫（重构到 `protyleMenus/protyle.contentMenu.ts`）

| 改进项 | 验证结果 | 说明 |
|--------|----------|------|
| 添加 `captionElement = hasClosestByTag(range.startContainer, "CAPTION")` | ❌ 缺失 | contentMenu 主函数中未检测 caption |
| 选区菜单守卫: `protyle.disabled \|\| captionElement` 时提前返回 | ❌ 缺失 | `添加选区相关菜单` 仅检查 `protyle.disabled` |
| 粘贴菜单守卫: `!protyle.disabled && !captionElement` | ❌ 缺失 | `添加粘贴菜单` 仅检查 `protyle.disabled` |
| 全选菜单守卫: `!captionElement` 时才显示 | ❌ 缺失 | `添加全选菜单` 无条件调用 |

## 缺失项汇总

共发现 **4项缺失**，均位于 `app/src/menus/protyleMenus/protyle.contentMenu.ts`，属于同一功能：**表格 caption 元素的右键菜单守卫**。

### 功能说明
上游在 contentMenu 中添加了对表格 caption 元素的检测，当光标位于 caption 内时：
- 禁止剪切/删除操作（选区菜单提前返回）
- 禁止粘贴操作
- 禁止全选操作
- 仅保留复制/复制纯文本功能

### 修复方案
1. 在 `contentMenu` 主函数中添加 `captionElement` 检测
2. 将 `captionElement` 传入各子函数或作为上下文字段
3. 在 `添加选区相关菜单`、`添加粘贴菜单`、`添加全选菜单` 中添加相应守卫条件

## 结论

**验证不通过** — 4项缺失均为同一功能（caption 右键菜单守卫），需修复后重新验证。
