/**
 * mermaidRender.environment.ts - Mermaid 渲染模块的 window 访问封装
 *
 * 封装 mermaidRender 所需的全局对象访问（window.mermaid、window.zenuml、window.siyuan.config），
 * 避免在业务代码中直接访问 window 全局对象。
 *
 * @module protyle/render/mermaidRender.environment
 */

/**
 * 获取 Mermaid 渲染器实例
 *
 * 作用：提供对动态加载的 window.mermaid 对象的访问
 * 意图：封装 window 全局对象访问，符合架构规范
 * 调用时机：Mermaid 脚本加载完成后调用
 *
 * @returns Mermaid 渲染器对象
 */
/** @同步豁免: 遗留代码 - 访问动态加载到 window 上的第三方库对象 */
export function getMermaidInstance(): Window["mermaid"] {
    return window.mermaid;
}

/**
 * 获取 ZenUML 外部图表模块
 *
 * 作用：提供对动态加载的 window.zenuml 对象的访问
 * 意图：封装 window 全局对象访问，Mermaid 注册外部图表时需要此对象
 * 调用时机：ZenUML 脚本加载完成后，注册到 Mermaid 前调用
 *
 * @returns ZenUML 模块对象
 */
/** @同步豁免: 遗留代码 - 访问动态加载到 window 上的第三方库对象 */
export function getZenumlModule(): Window["zenuml"] {
    return window.zenuml;
}

/**
 * 判断当前是否为暗色主题模式
 *
 * 作用：读取 siyuan 配置中的外观模式
 * 意图：封装 window.siyuan.config 访问，Mermaid 需要根据主题切换 dark/default
 * 调用时机：初始化 Mermaid 配置时调用
 *
 * @returns true 表示暗色模式，false 表示亮色模式
 */
/** @同步豁免: 遗留代码 - 读取已加载的配置对象，无异步需求 */
export function isDarkMode(): boolean {
    return window.siyuan?.config?.appearance?.mode === 1;
}
