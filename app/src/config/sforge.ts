/**
 * sforge.ts - SForge 全局状态管理入口
 * 
 * 用于管理非思源原生的全局状态，避免与 window.siyuan 冲突
 * 使用 Symbol 属性键确保状态隔离
 */

import { ProfileManager } from "./profileManager";

// 重新导出全局状态管理相关
export { SForgeSymbols } from "./sforge.symbols";
export type { ISForgeGlobalState } from "./sforge.types";
export {
    获取SForge全局对象,
    getSForgeState,
    setSForgeState
} from "./sforge.global";

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
                auth: ProfileManager.getInstance("ai_modelscope_auth"),
                text2image: ProfileManager.getInstance("ai_modelscope_text2image")
            }
        }
    };
};
