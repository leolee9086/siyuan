# Breadcrumb 文件拆分重构计划

> **最后更新**: 2025-12-30 10:25
> **状态**: 进行中

---

## 进度概览

| 阶段 | 状态 | 备注 |
|------|------|------|
| 规划 | ✅ 完成 | |
| 拆分 showBreadcrumbMenu.ts | ✅ 完成 | 507→206行 |
| 清理冗余类型 | ✅ 完成 | 移除 SiyuanMenu |
| 拆分 index.ts 事件处理 | ✅ 完成 | 333→233行 |
| 拆分 menuItems.ts | ✅ **完成** | 321→217行 |
| 修复 Lint 错误 | 🔄 进行中 | 剩余 index.ts eslint 错误 |
| **逻辑核查** | ✅ **完成** | 对比 index.old.ts 修复逻辑缺失 (searchPreview) |

---

## 当前文件状态

| 文件 | 行数 | 限制 | 状态 |
|------|------|------|------|
| action.ts | 175 | 300 | ✅ |
| breadcrumb.events.ts | 230 | 300 | ✅ |
| **breadcrumb.guard.ts** | **10** | 300 | ✅ **新增** |
| breadcrumb.types.ts | 39 | 300 | ✅ |
| index.ts | 233 | 300 | ✅ |
| menuItems.ts | **217** | 300 | ✅ **已修复** |
| **menuItems.upload.ts** | **154** | 300 | ✅ **新增** |
| showBreadcrumbMenu.ts | 205 | 300 | ✅ |
| breadcrumb.helpers.ts | 180 | 300 | ✅ |

---

## 已完成工作

- [x] 创建 `menuItems.ts`，提取 6 个菜单项辅助函数
- [x] ~~创建 `SiyuanMenu` 类型别名~~ → 已移除，直接使用 `Menu` 类
- [x] 更新 `showBreadcrumbMenu.ts` 使用新模块
- [x] 移除冗余 `SiyuanMenu` 类型别名
- [x] 创建 `breadcrumb.events.ts`，提取事件处理逻辑 (index.ts 333→233行)
- [x] 创建 `menuItems.upload.ts`，提取上传和录音菜单项 (menuItems.ts 321→217行)
- [x] 创建 `breadcrumb.guard.ts`，提取类型守卫函数
- [x] **修复 TS 错误**: `mediaRecorder` 初始化报错
- [x] **逻辑修复**: `breadcrumb.helpers.ts` 补充 `searchPreview` 特殊处理逻辑 (回归测试发现)

---

## 待完成工作

### 1. Lint 错误修复 🔄 进行中

**index.ts** (~20个错误):
- [ ] mousewheel 事件类型问题 (L76) - *注意: 已修改为 wheel 事件，需确认兼容性*
- [ ] 3x forEach 循环 → 改用 for...of
- [ ] 5x 嵌套 if → 使用卫语句
- [ ] 4x else 语句 → 使用卫语句
- [ ] 1x window 直接访问 → 封装到 environment 文件
- [ ] 3x as 断言 → 使用类型守卫
- [ ] 2x 内联回调超长 → 提取为命名函数或添加豁免注释
- [ ] render 方法过长 (65行 > 50行)

**menuItems.ts** (6个错误):
- [ ] 1x globalThis 访问 (L65)
- [ ] 2x 非空断言 (L138, L175)
- [ ] 1x 内联回调超长 (L104)

---

## 验证方法 (已执行)
1. ✅ 对比 `index.ts` 和 `index.old.ts` 的功能等价性 (发现并修复 breadcrumb.helpers.ts 差异)
2. `npx eslint src/protyle/breadcrumb/`
3. `npx tsc --noEmit`

