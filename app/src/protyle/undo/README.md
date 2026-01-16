# Protyle Undo (撤销/重做) 模块

`app/src/protyle/undo` 目录管理编辑器前端层面的撤销与重做操作历史。

## 目录结构与功能说明

- **[index.ts](file:///d:/dev/siyuan-note/app/src/protyle/undo/index.ts)**
  实现前端的历史栈管理。记录用户在编辑器中的操作快照，并支持撤销回退。

---

## 注意事项
- 核心的数据版本控制由内核处理，本目录主要负责前端 UI 的状态回滚。
