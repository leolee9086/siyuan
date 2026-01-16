# 思源笔记 Emoji (表情符号) 模块

`app/src/emoji` 目录负责管理思源笔记中的表情符号选择、渲染及快捷输入逻辑。

## 目录结构与功能说明

- **[index.ts](file:///d:/dev/siyuan-note/app/src/emoji/index.ts)**
  表情选择面板的核心实现。包含基础表情库的加载、搜索过滤、最近使用表情的持久化以及在编辑器光标处插入表情的逻辑。

---

## 注意事项
- 表情库通常采用 Unicode 字符或特定的 SVG 符号。
- 搜索逻辑支持拼音匹配（依赖 `util/pinyin.ts`）。
