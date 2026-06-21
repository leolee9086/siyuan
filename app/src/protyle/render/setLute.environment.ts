/**
 * setLute.environment.ts - setLute 模块的 window 访问封装
 *
 * 封装 setLute 所需的全局对象访问（window.siyuan.config、window.siyuan.emojis），
 * 避免在业务代码中直接访问 window 全局对象。
 *
 * @module protyle/render/setLute.environment
 */

/**
 * 获取编辑器配置对象
 *
 * 作用：从全局 siyuan 配置中读取 editor 配置段
 * 意图：封装 window.siyuan.config.editor 访问
 * 调用时机：初始化 Lute 实例时调用
 */
/** @同步豁免: 遗留代码 - 读取已加载的全局配置对象 */
export const getEditorConfig = () => window.siyuan?.config?.editor;

/**
 * 获取编辑器 Markdown 配置对象
 *
 * 作用：从编辑器配置中读取 markdown 子配置
 * 意图：封装 window.siyuan.config.editor.markdown 访问
 * 调用时机：初始化 Lute 实例的 Markdown 相关选项时调用
 */
/** @同步豁免: 遗留代码 - 读取已加载的全局配置对象 */
export const getEditorMarkdownConfig = () => window.siyuan?.config?.editor?.markdown;

/**
 * 获取全局表情列表
 *
 * 作用：获取 siyuan 注册的全局表情分组列表
 * 意图：封装 window.siyuan.emojis 访问
 * 调用时机：初始化 Lute 的表情映射时调用
 */
/** @同步豁免: 遗留代码 - 读取已加载的全局表情数据 */
export const getEmojisList = () => window.siyuan?.emojis;
