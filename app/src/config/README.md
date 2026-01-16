# 思源笔记 Config (设置中心) 模块

`app/src/config` 目录实现了思源笔记所有的配置选项界面及后台设置管理逻辑。

## 目录结构与功能说明

### 1. 核心管理
- **[index.ts](file:///d:/dev/siyuan-note/app/src/config/index.ts)**
  设置中心弹出框的入口程序。负责构建设置界面的主框架及侧边导航菜单。
- **[profileManager.ts](file:///d:/dev/siyuan-note/app/src/config/profileManager.ts)**
  配置方案（Profile）管理器。支持用户切换不同的配置存储路径或工作空间。

### 2. 设置分类页面
- **[appearance.ts](file:///d:/dev/siyuan-note/app/src/config/appearance.ts)**: 外观设置（主题、图标、语言、窗口样式）。
- **[editor.ts](file:///d:/dev/siyuan-note/app/src/config/editor.ts)**: 编辑器行为设置（打字机模式、实时渲染选项、辅助功能）。
- **[keymap.ts](file:///d:/dev/siyuan-note/app/src/config/keymap.ts)**: 快捷键自定义及映射关系管理。
- **[image.ts](file:///d:/dev/siyuan-note/app/src/config/image.ts)**: 资源文件及图片上传/处理设置。
- **[account.ts](file:///d:/dev/siyuan-note/app/src/config/account.ts)**: 账号信息、云端同步服务配置。

### 3. 子系统设置
- **[ai/](file:///d:/dev/siyuan-note/app/src/config/ai/)**: AI 服务的具体供应商配置（API Key, 模型选择）。
- **[bazzar/](file:///d:/dev/siyuan-note/app/src/config/bazzar/)**: 市集（插件、主题、模板下载）相关的界面与逻辑。
- **[configSchemas/](file:///d:/dev/siyuan-note/app/src/config/configSchemas/)**: 存放所有配置项的 JSON Schema 定义及默认值。

---

## 注意事项
- 所有的设置更改通常会立即通过网络请求（`/api/setting/...`）同步到内核（Kernel），并触发相应的 `boot/onGetConfig` 增量更新。
- 修改设置界面的交互时，应当遵循 `b3-list` 和 `b3-form` 的标准样式架构，以保持 UI 的一致性。
