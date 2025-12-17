# commonMenuItem.patch.ts 文件拆分计划

## 文件分析

`commonMenuItem.patch.ts` 文件包含 683 行代码，包含以下主要功能：

1. **微信通知功能** (`openFileWechatNotify`) - 处理微信提醒设置
2. **文件属性功能** (`openFileAttr`, `openAttr`) - 处理文件属性对话框
3. **导出功能** (`exportMd`) - 处理各种导出格式
4. **重命名功能** (`renameMenu`) - 处理文件/笔记本重命名
5. **移动功能** (`movePathToMenu`) - 处理文件移动

## 拆分策略

根据高内聚低耦合原则和文件命名规则，将文件拆分为以下模块：

### 1. 微信通知模块
- **文件名**: `commonMenuItem.wechatNotify.ts`
- **功能**: 处理微信提醒相关功能
- **导出**: `openFileWechatNotify`

### 2. 文件属性模块
- **文件名**: `commonMenuItem.fileAttr.ts`
- **功能**: 处理文件属性对话框和相关逻辑
- **导出**: `openFileAttr`, `openAttr`, `bindAttrInput`

### 3. 导出功能模块
- **文件名**: `commonMenuItem.export.ts`
- **功能**: 处理各种导出格式和导出菜单
- **导出**: `exportMd`

### 4. 文件操作模块
- **文件名**: `commonMenuItem.fileOps.ts`
- **功能**: 处理文件重命名和移动操作
- **导出**: `renameMenu`, `movePathToMenu`

### 5. 主文件
- **文件名**: `commonMenuItem.patch.ts` (保留)
- **功能**: 作为聚合文件，重新导出所有模块的功能
- **导出**: 重新导出上述所有模块的导出

## 拆分步骤

1. **创建微信通知模块** - 提取 `openFileWechatNotify` 函数
2. **创建文件属性模块** - 提取 `openFileAttr`, `openAttr`, `bindAttrInput` 函数
3. **创建导出功能模块** - 提取 `exportMd` 函数
4. **创建文件操作模块** - 提取 `renameMenu`, `movePathToMenu` 函数
5. **更新主文件** - 修改原文件为聚合导出文件

## 依赖关系处理

各模块的依赖关系：
- 所有模块都需要基础导入（如 `fetchPost`, `Dialog` 等）
- 文件属性模块需要使用微信通知模块的功能
- 主文件需要导入并重新导出所有模块

## 注意事项

1. 保持原有的导入导出关系不变
2. 确保拆分后的每个文件只包含一个主要功能
3. 遵循 TypeScript 文件规则，每个文件只有一个具名导出
4. 使用 patch 规则，确保模块解析正确
5. 保持函数签名和行为完全一致