/**
 * sforge.global.ts - SForge 全局对象访问
 * 
 * 封装 globalThis 访问，符合架构规范
 */

/** 用途：SForge 全局 Symbol 键定义。使用范围：globalThis 属性键名。解耦评估：同目录常量文件，直接导入。 */
import { SForgeSymbols } from "./sforge.symbols";
/** 用途：SForge 全局状态类型。使用范围：函数返回值类型推导。解耦评估：同目录类型文件，类型导入。 */
import type { ISForgeGlobalState } from "./sforge.types";
/** 用途：类型守卫，将 globalThis 断言为带 SForge 状态的对象。使用范围：获取/设置全局状态前进行类型转换。解耦评估：同目录守卫函数，直接导入。 */
import { asGlobalWithSForge } from "./sforge.guard";

/**
 * 获取或创建 SForge 全局对象
 * 挂载在 globalThis 上，确保跨模块单例
 * @同步豁免: 生命周期 - 模块初始化阶段的基础设施，必须在其他模块加载前同步完成初始化
 */
export function 获取SForge全局对象() {
    const globalObj = asGlobalWithSForge(globalThis);
    const key = SForgeSymbols.GLOBAL_KEY;

    // 首次访问时初始化：当全局对象上尚未挂载 SForge 状态时，创建空对象作为初始状态容器
    if (!globalObj[key]) {
        globalObj[key] = {};
    }

    return globalObj[key];
}

/**
 * 获取 SForge 全局状态中的某个值
 * @param symbolKey Symbol 键
 * @returns 对应的值
 * @同步豁免: 生命周期 - 状态读取是基础设施操作，被模块初始化和同步代码路径依赖
 */
export function getSForgeState<K extends keyof ISForgeGlobalState>(
    symbolKey: K
) {
    return 获取SForge全局对象()[symbolKey];
}

/**
 * 设置 SForge 全局状态中的某个值
 * @param symbolKey Symbol 键
 * @param value 要设置的值
 * @同步豁免: 生命周期 - 状态写入是基础设施操作，必须在模块初始化阶段同步完成
 */
export function setSForgeState<K extends keyof ISForgeGlobalState>(
    symbolKey: K,
    value: ISForgeGlobalState[K]
) {
    获取SForge全局对象()[symbolKey] = value;
}
