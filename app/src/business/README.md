# 思源笔记 Business (业务逻辑) 模块

`app/src/business` 目录包含了一些特定的、不属于编辑器核心但属于应用核心流程的业务逻辑。

## 目录结构与功能说明

### 1. 最近文档管理
- **[openRecentDocs.ts](file:///d:/dev/siyuan-note/app/src/business/openRecentDocs.ts)**
  负责加载并展示用户最近操作过的文档列表。
- **[selectRecentDoc.ts](file:///d:/dev/siyuan-note/app/src/business/selectRecentDoc.ts)**
  处理从最近文档列表中选择并打开目标文件的交互逻辑。

---

## 注意事项
- 本模块通过 `Model` 与布局系统关联。
