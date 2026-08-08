/**
 * 本地文件编辑页签的稳定类型标识。
 *
 * 这个模块只包含数据常量，供打开端口读取而不触发 Monaco、Vue 面板或
 * 编辑器 worker 的依赖解析。编辑器页签的实现仍由 FileBrowser.editor.ts
 * 负责注册。
 */
export const FILE_BROWSER_EDITOR_TAB_TYPE = "sforge-file-editor";
