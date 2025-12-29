/**
 * sforge.ts - SForge 全局状态管理入口
 * 
 * 用于管理非思源原生的全局状态，避免与 window.siyuan 冲突
 * 使用 Symbol 属性键确保状态隔离
 */

import { ProfileManager } from "./profileManager";

// 重新导出全局状态管理相关
export { SForgeSymbols, SForge符号 } from "./sforge.symbols";
export type { ISForgeGlobalState } from "./sforge.types";
export {
    获取SForge全局对象,
    getSForgeState,
    setSForgeState,
    获取SForge状态,
    设置SForge状态
} from "./sforge.global";

// ============ SForge 配置访问器 ============

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
