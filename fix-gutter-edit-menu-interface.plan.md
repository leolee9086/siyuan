# 修复 GutterEditMenu 接口定义问题

## 任务描述
修复 buildGutterEditMenu.ts 文件中的 ESLint 错误：禁止在业务/UI文件定义 Interface，需要将接口移至 *.types.ts 文件。

## 任务列表
- [x] 创建 gutter.types.ts 文件，用于存放 gutter 模块的类型定义
- [x] 将 IGutterEditMenuContext 接口从 buildGutterEditMenu.ts 移动到 gutter.types.ts
- [x] 修改 buildGutterEditMenu.ts 文件，导入新定义的类型
- [x] 验证修改后的代码没有引入新的问题