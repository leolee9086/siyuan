# Protyle Upload (文件上传) 模块

`app/src/protyle/upload` 目录处理从外部拖拽或粘贴至编辑器时的文件上传逻辑。

## 目录结构与功能说明

- **[index.ts](file:///d:/dev/siyuan-note/app/src/protyle/upload/index.ts)**
  管理整个上传流程：接收文件、显示进度条、调用内核 API 存储资产并回写 Markdown 引用链接。

---

## 注意事项
- 粘贴图片或附件时的自动上传行为由本模块触发。
