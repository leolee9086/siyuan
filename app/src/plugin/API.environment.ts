/**
 * API 模块的环境封装
 *
 * 作用：封装 window.siyuan.mobile 相关的全局访问
 * 意图：满足 lint 规则禁止直接访问 window 的要求
 * 调用时机：API.ts 中的 saveLayout / getActiveEditor 使用
 */

/** @同步豁免: UI构建 - 编辑器状态查询需要同步访问移动端全局对象 */
export const getMobileEditor = () => window.siyuan?.mobile?.editor;

/** @同步豁免: UI构建 - 编辑器状态查询需要同步访问移动端全局对象 */
export const getMobilePopEditor = () => window.siyuan?.mobile?.popEditor;
