# app/src/util 目录拆分重组 执行跟踪 (TikTocTak)

> **目标**: 将 `app/src/util` 从50个顶层条目重组到≤10个，满足 `folder-item-limit` lint规则
>
> **规程**: [代码拆分与模块化](../规程/代码质量/代码拆分与模块化.procedure.md)、[lint错误修复](../规程/代码质量/lint错误修复.procedure.md)

---

## 现状分析

当前50个条目 = 33个松散文件 + 17个子目录

### 松散文件清单

| 文件 | 职责 | 目标目录 |
|------|------|----------|
| fetch.ts, fetch.types.ts, fetch.guard.ts, fetchStream.ts | 网络请求 | network/ |
| serviceWorker.ts | ServiceWorker注册 | network/ |
| processMessage.ts | WebSocket消息处理 | network/ |
| cronjob.types.ts, cronjobApi.ts, cronjobAuth.ts | 定时任务 | network/ |
| assets.ts | 主题/资源加载 | assets/ |
| color.ts | 颜色工具 | assets/ |
| image.ts | 图片处理 | assets/ |
| addClearButton.ts | 清除按钮UI | DOM/ |
| setPosition.ts | 元素定位 | DOM/ |
| upDownHint.ts | 上下选择提示 | DOM/ |
| genOptions.ts | 生成option元素 | DOM/ |
| highlightById.ts | 元素高亮 | DOM/ |
| escape.ts | HTML转义 | DOM/ |
| pathName.ts | 路径工具 | file/ |
| newFile.ts | 新建文件 | file/ |
| getSavePath.ts | 保存路径 | file/ |
| mount.ts | 挂载操作 | file/ |
| Tree.ts | 树结构 | file/ |
| backForward.ts | 前进后退导航 | navigation/ |
| focusStack.ts | 焦点栈管理 | navigation/ |
| functions.ts | 通用工具函数 | platform/ |
| genID.ts | ID生成 | platform/ |
| pinyin.ts | 拼音转换 | platform/ |
| noRelyPCFunction.ts | 非PC依赖函数 | platform/ |
| iOSPurchase.ts | iOS购买 | platform/ |
| needSubscribe.ts | 订阅检查 | platform/ |
| README.md | 文档 | 保留 |
| tiktoktac.zhinote.md | 笔记 | 保留 |

### 现有子目录清单

| 子目录 | 文件数 | 目标 |
|--------|--------|------|
| assets/ | 3 | → assets/ (合并松散文件) |
| css/ | 3 | → assets/ (合并) |
| DOM/ | 9 | → DOM/ (合并松散文件) |
| range/ | 1 | → DOM/ (合并) |
| controFlow/ | 2 | → DOM/ (合并) |
| pathName/ | 12 | → file/ (合并) |
| siyuanEnvironments/ | 多 | 保留 |
| pathRouter/ | 多 | 保留 |
| code/ | 11 | → infra/ (合并) |
| events/ | 6 | → infra/ (合并) |
| logger/ | 4 | → infra/ (合并) |
| ptrinet/ | 1子目录 | → infra/ (合并) |
| zodMethodDefinedClass/ | 多 | → infra/ (合并) |
| vue/ | 3 | → infra/ (合并) |
| dialog/ | 1 | → infra/ (合并) |
| embedding/ | 3 | → infra/ (合并) |
| noteDatas/ | 1 | → infra/ (合并) |

## 目标结构 (10个顶层条目)

```
app/src/util/
├── README.md            ← 保留
├── assets/              ← assets.ts, color, image + 原assets/*, css/*
├── DOM/                 ← 原DOM/*, range/*, controFlow/* + 松散DOM文件
├── file/                ← pathName.ts, pathName/*, newFile, getSavePath, mount, Tree, noteDatas/id
├── lib/                 ← code/, events/, logger/, embedding/, zodMethodDefinedClass/
├── network/             ← fetch*, serviceWorker, processMessage, cronjob*
├── pathRouter/          ← 保留不动
├── platform/            ← functions, genID, pinyin, noRelyPCFunction, iOSPurchase, needSubscribe, backForward, focusStack
├── siyuanEnvironments/  ← 保留不动
├── vue/                 ← 原vue/* + dialog/createVueDialog
```

> 注1: 原方案 infra/ 改为 lib/，更简洁直观
> 注2: navigation/ (backForward, focusStack) 合并入 platform/，减少顶层条目
> 注3: dialog/createVueDialog 合并入 vue/，noteDatas/id 合并入 file/
> 注4: ptrinet/core/design.md 移至 docs/design/ptrinet/，tiktoktac.zhinote.md 移至 docs/ttt/

---

## ✅ 任务完成

> 完成时间: 2026-02-27
> 最终结构: 10个顶层条目 (README.md, assets/, DOM/, file/, lib/, network/, pathRouter/, platform/, siyuanEnvironments/, vue/)
> 总迁移文件数: 约86个文件
> 验证结果: lint通过，构建通过

---

## 🏁 已归档/已完成

- [x] **Phase 0: 用户确认目标结构 (P0)** ✅ 2026-02-27
  - 用户确认并在执行过程中调整: infra/ → lib/，navigation/ 合并入 platform/

- [x] **Phase 1: 备份原始目录 (P0)** ✅ 2026-02-27
  - 备份 `app/src/util` 到 `app/src/util.backup` (154个文件，已验证一致)

- [x] **Phase 2: 创建目标子目录并移动文件 (P0)**
  - [x] network/ — 9个文件已迁移 (fetch*, fetchStream, serviceWorker, processMessage, cronjob*) ✅ 2026-02-27
    - 迁移脚本自动更新了261个.ts/.tsx文件的264处import
    - 手动修复1个.vue文件 (recentDocsAndDocks.vue) 的import路径
  - [x] assets/ — 5个文件已迁移 (color, image + css/bgs.modern, css/bgs, css/extractCSSVariables) ✅ 2026-02-27
    - 合并了 css/ 子目录到 assets/，空目录已删除
    - 迁移脚本自动更新了17个.ts文件的12处import
    - .vue文件无引用，无需手动修复
  - [x] DOM/ — 9个文件已迁移 (addClearButton, setPosition, upDownHint, genOptions, highlightById, escape, range.copyWithResolvedCSS, matchCondition, matchIf) ✅ 2026-02-27
    - 合并了 range/ 和 controFlow/ 子目录到 DOM/，两个空目录已删除
    - 迁移脚本自动更新了144个.ts文件的159处import
    - 手动修复1个.vue文件 (recentDocsAndDocks.vue) 的import路径
  - [x] file/ — 17个文件已迁移 (pathName, newFile, getSavePath, mount, Tree + 12个原pathName/文件) ✅ 2026-02-27
    - 合并了 pathName/ 子目录到 file/，空目录已删除
    - 迁移脚本自动更新了116个.ts文件的131处import
    - 手动修复1个.vue文件 (AssetMasonryDialog.vue) 的import路径
    - 手动修复4个同批次文件间的残留引用 (movePathTo.click.ts, movePathTo.keydown.ts, movePathTo.ts, fileHtmlGenerator.ts)
  - [x] navigation/ — 2个文件已迁移 (backForward, focusStack) ✅ 2026-02-27
    - 迁移脚本自动更新了11个.ts文件的9处import
    - .vue文件无引用，无需手动修复
  - [x] platform/ — 6个文件已迁移 (functions, genID, pinyin, noRelyPCFunction, iOSPurchase, needSubscribe) ✅ 2026-02-27
    - 迁移脚本自动更新了177个.ts文件的192处import
    - 手动修复2个.vue文件 (dockPanel.vue, docsPanel.vue) 的import路径
  - [x] lib/ — 33个文件已迁移 (code/11, events/6, logger/4, embedding/3, zodMethodDefinedClass/9) ✅ 2026-02-27
    - 迁移脚本自动更新了14个外部.ts文件的15处import + 31个被移动文件的内部import
    - 手动修复1个目录级import (keydown.list/logger.ts → util/lib/logger)
    - 手动修复1个跨目录引用 (lib/zodMethodDefinedClass/layer.ts → pathRouter/core/types)
    - .vue文件无引用，无需手动修复
    - 2个readme.md通过git mv移动
    - 5个原空目录已清理
  - [x] dialog/ → vue/ — 1个文件已迁移 (createVueDialog) ✅ 2026-02-27
    - 迁移脚本自动更新了3个.ts文件的3处import
    - .vue文件无引用，无需手动修复
    - 空目录 dialog/ 已清理
  - [x] navigation/ → platform/ — 2个文件已合并 (backForward, focusStack) ✅ 2026-02-27
    - 迁移脚本自动更新了9个.ts文件的9处import
    - backForward.ts 与 focusStack.ts 同批次互引已由脚本正确更新
    - .vue文件无引用，无需手动修复
    - 空目录 navigation/ 已清理
  - [x] noteDatas/ → file/ — 1个文件已合并 (id.ts) ✅ 2026-02-27
    - 迁移脚本自动更新了1个.ts文件的1处import
    - .vue文件无引用，无需手动修复
    - 空目录 noteDatas/ 已清理
  - [x] assets.ts → assets/ — 1个松散文件已移入 assets/ 目录 ✅ 2026-02-27
    - 迁移脚本自动更新了11个.ts文件的11处import
    - assets.ts 内部引用已由脚本正确更新为同目录相对路径
    - .vue文件无引用，无需手动修复
  - [x] cleanup — 非代码文件迁移 ✅ 2026-02-27
    - `ptrinet/core/design.md` → `docs/design/ptrinet/design.md` (git mv)
    - `tiktoktac.zhinote.md` → `docs/ttt/util-tiktoktac.zhinote.md` (git mv)
    - 空目录 ptrinet/ 已清理
    - 最终 util/ 顶层恰好10个条目: README.md, network/, assets/, DOM/, file/, platform/, siyuanEnvironments/, pathRouter/, vue/, lib/

- [x] **Phase 3: 全量验证 (P0)** ✅ 2026-02-27
  - 构建通过，无编译错误

- [x] **Phase 4: lint验证 (P0)** ✅ 2026-02-27
  - `pnpm run lint:file` 验证 folder-item-limit 不再报错
  - 全量构建确认无编译错误

