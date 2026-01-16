# 思源笔记 Card (闪卡/间隔复习) 模块

`app/src/card` 目录实现了思源笔记的核心功能之一：基于间隔复习算法的闪卡系统。

## 目录结构与功能说明

### 1. 核心流程
- **[makeCard.ts](file:///d:/dev/siyuan-note/app/src/card/makeCard.ts)**
  负责将内容块（Block）转换为闪卡的逻辑，处理标签标记、排版解析等。
- **[openCard.ts](file:///d:/dev/siyuan-note/app/src/card/openCard.ts)**
  闪卡复习界面的主入口。负责加载复习队列、管理复习进度及渲染卡片内容。
- **[viewCards.ts](file:///d:/dev/siyuan-note/app/src/card/viewCards.ts)**
  提供闪卡管理与批量视图功能。

### 2. 生命周期与工具
- **[newCardTab.ts](file:///d:/dev/siyuan-note/app/src/card/newCardTab.ts)**
  处理在新标签页中打开复习界面的逻辑。
- **[util.ts](file:///d:/dev/siyuan-note/app/src/card/util.ts)**
  包含间隔复习算法（如 FSRS/SM-2 适配）及卡片状态计算相关的辅助函数。

---

## 注意事项
- 闪卡系统重度依赖于 Protyle 的预览模式渲染。
- 卡片的复习状态（如 D/S/L/R）通过 API 实时同步至内核数据库。
