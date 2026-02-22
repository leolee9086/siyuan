/**
 * Model.registry.ts - Model WebSocket 处理器注册表访问
 *
 * 通过 SForge 注册表注入 Model 的运行时依赖（processMessage、kernelError、reloadSync），
 * 打断 Model ↔ processSystem/processMessage 的循环依赖链。
 *
 * 注册方式：调用者直接使用 setSForgeState(SForgeSymbols.MODEL_HANDLERS, handlers)
 * 注册时机：应用入口初始化阶段，在任何 Model 实例创建之前
 */

import { SForgeSymbols } from "../config/sforge.symbols";
import { getSForgeState } from "../config/sforge.global";
import { isModelHandlers } from "../config/sforge.guard";
import type { IModelHandlers } from "../config/sforge.types";

/**
 * 获取已注册的 Model WebSocket 处理器
 *
 * 作用：从 SForge 全局注册表读取处理器，并通过类型守卫校验
 * 意图：供 Model.ts 的 WebSocket 回调使用，确保处理器已注册且类型正确
 * 调用时机：Model 实例的 WebSocket 事件回调中
 * @同步豁免: 生命周期 - WebSocket 事件回调中的同步状态读取，处理器在应用初始化阶段已注册
 */
export function getModelHandlers(): IModelHandlers {
    const handlers = getSForgeState(SForgeSymbols.MODEL_HANDLERS);
    if (!isModelHandlers(handlers)) {
        throw new Error("Model handlers not registered. Call setSForgeState(SForgeSymbols.MODEL_HANDLERS, ...) before creating Model instances.");
    }
    return handlers;
}
