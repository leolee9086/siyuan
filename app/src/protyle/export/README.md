# Protyle Export (内容导出) 模块

`app/src/protyle/export` 目录负责将 Protyle 的内容导出为不同的格式或预览效果。

## 目录结构与功能说明

- **[index.ts](file:///d:/dev/siyuan-note/app/src/protyle/export/index.ts)**
  处理导出对话框的弹出及导出参数（如是否包含题图、是否转换内部引用）的配置。

---

## 注意事项
- 复杂的渲染转换逻辑通常由内核同步进行，前端主要负责发起请求并获取文件下载连接。
