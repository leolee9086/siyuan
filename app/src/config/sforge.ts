/**
 * sforge.ts - SForge 全局状态管理入口
 * 
 * 用于管理非思源原生的全局状态，避免与 window.siyuan 冲突
 * 使用 Symbol 属性键确保状态隔离
 */

/** 用途：Profile 管理器。使用范围：获取 AI 配置实例（ModelScope 认证等）。解耦评估：同目录模块直接导入。 */
import { getProfileManagerInstance } from "./profileManager";

/** 用途：SForge Symbol 键定义。使用范围：重新导出供外部模块使用。解耦评估：同目录符号定义，直接导入转发。 */
import { SForgeSymbols } from "./sforge.symbols";
/** 导出 SForgeSymbols，供外部模块使用 */
export { SForgeSymbols };

/** 用途：SForge 全局状态类型。使用范围：重新导出供外部模块使用。解耦评估：同目录类型文件，类型导入转发。 */
import type { ISForgeGlobalState } from "./sforge.types";
/** 导出 ISForgeGlobalState 类型，供外部模块使用 */
export type { ISForgeGlobalState };

/** 用途：获取 SForge 全局对象。使用范围：重新导出供外部模块使用。解耦评估：同目录全局状态模块，直接导入转发。 */
import { 获取SForge全局对象 } from "./sforge.global";
/** 导出 获取SForge全局对象，供外部模块使用 */
export { 获取SForge全局对象 };

/** 用途：获取 SForge 状态。使用范围：重新导出供外部模块使用。解耦评估：同目录全局状态模块，直接导入转发。 */
import { getSForgeState } from "./sforge.global";
/** 导出 getSForgeState，供外部模块使用 */
export { getSForgeState };

/** 用途：设置 SForge 状态。使用范围：重新导出供外部模块使用。解耦评估：同目录全局状态模块，直接导入转发。 */
import { setSForgeState } from "./sforge.global";
/** 导出 setSForgeState，供外部模块使用 */
export { setSForgeState };

// ============ SForge 配置访问器 ============

/**
 * 获取 SForge 配置对象
 *
 * 作用：提供统一的配置访问入口，返回包含 AI 相关配置的结构化对象
 * 意图：集中管理各模块的 ProfileManager 实例，避免分散的配置访问
 * 调用时机：在需要访问 AI 配置（如 ModelScope 认证、文生图配置）时调用
 *
 * @同步豁免: 生命周期 - 配置访问器在模块初始化阶段被调用，必须同步返回配置对象
 */
export const getSForgeConfigs = () => {
    return {
        ai: {
            modelScope: {
                auth: getProfileManagerInstance("ai_modelscope_auth"),
                text2image: getProfileManagerInstance("ai_modelscope_text2image")
            }
        }
    };
};
