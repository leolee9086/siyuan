/**
 * API 模块的环境封装
 *
 * 作用：封装插件模块对 window 全局对象的访问
 * 意图：满足 lint 规则禁止直接访问 window 的要求
 * 调用时机：API.ts / loader.ts 中读取移动端编辑器、require 和 eval 时使用
 */

/** @同步豁免: UI构建 - 编辑器状态查询需要同步访问移动端全局对象 */
export const getMobileEditor = () => window.siyuan?.mobile?.editor;

/** @同步豁免: UI构建 - 编辑器状态查询需要同步访问移动端全局对象 */
export const getMobilePopEditor = () => window.siyuan?.mobile?.popEditor;

/**
 * 获取插件运行时的 require 函数
 *
 * 作用：封装 window.require 访问，供插件加载器构建 CommonJS 运行时
 * 意图：避免在业务文件中直接访问 window，全局访问集中到 environment 层
 * 调用时机：loader.ts 初始化 requireFunc 时
 *
 * @同步豁免: 生命周期 - 插件运行时初始化依赖同步读取 window.require
 */
export const getPluginRuntimeRequire = () => window.require;

/**
 * 在插件运行时执行代码字符串
 *
 * 作用：封装 window.eval，用于执行从内核下发的插件入口代码
 * 意图：将高风险全局 API 访问收敛到 environment 层，减少业务代码耦合
 * 调用时机：loader.ts 构建插件模块执行函数时
 *
 * @同步豁免: 生命周期 - 插件加载阶段需要同步编译并执行模块函数
 */
export const evaluatePluginCode = (code: string) => {
    const source = String(code);
    return window.eval(source);
};
