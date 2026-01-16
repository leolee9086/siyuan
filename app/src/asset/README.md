# 思源笔记 Asset (资产处理) 模块

`app/src/asset` 目录负责思源笔记中资源文件（PDF、图片等）的解析、渲染及高级交互逻辑（如 PDF 标注）。

## 目录结构与功能说明

### 1. PDF 标注系统
- **[anno.ts](file:///d:/dev/siyuan-note/app/src/asset/anno.ts)** & **[anno.types.ts](file:///d:/dev/siyuan-note/app/src/asset/anno.types.ts)**
  PDF 标注系统的核心逻辑。管理高亮、矩形选区、标注链接（Relation）的创建与显示。
- **[pdf/](file:///d:/dev/siyuan-note/app/src/asset/pdf/)**
  集成 PDF.js 及其插件，处理 PDF 的文档加载、缩放及滚动同步。
- **[anno.setRelation.ts](file:///d:/dev/siyuan-note/app/src/asset/anno.setRelation.ts)**
  处理标注结果与思源文档块之间的关联逻辑。

### 2. 素材与对话框
- **[index.ts](file:///d:/dev/siyuan-note/app/src/asset/index.ts)**
  资源管理的主入口。
- **[assetDialog.ts](file:///d:/dev/siyuan-note/app/src/asset/assetDialog.ts)**
  资源插入对话框的实现，支持从本地或云端选择素材。
- **[renderAssets.ts](file:///d:/dev/siyuan-note/app/src/asset/renderAssets.ts)**
  负责在编辑器中渲染资源预览（如图片缩略图、PDF 覆盖层）。

---

## 注意事项
- PDF 标注逻辑与 Protyle 的引用系统深度耦合，修改标注坐标计算（`anno.getHightlightCoords`）时需兼顾响应式缩放。
- 大量资源的渲染依赖于 `util/assets.ts` 中的路径转换函数。
