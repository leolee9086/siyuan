/** 用途：Model handlers 的全局 Symbol；使用范围：能力注册和读取；解耦评估：稳定运行时键，不导入具体实现。 */
import { SForgeSymbols } from "../../config/sforge.symbols";
/** 用途：读取不透明全局能力；使用范围：WebSocket 回调；解耦评估：通用存储只处理 unknown，由本模块校验。 */
import { getSForgeState } from "../../config/sforge.global";
/** 用途：注册不透明全局能力；使用范围：应用启动；解耦评估：具体签名保留在本能力边界。 */
import { setSForgeState } from "../../config/sforge.global";
/** 用途：运行时校验能力对象；使用范围：读取后恢复精确类型；解耦评估：局部守卫。 */
import { isModelHandlers } from "./modelHandlers.guard";
/** 用途：Model handlers 契约；使用范围：注册和读取签名；解耦评估：纯类型依赖。 */
import type { IModelHandlers } from "./types";

/** 注册 Model WebSocket 回调能力；具体签名由 Layout 边界持有。 */
// @柯里化 固定 Model handlers 的注册槽，调用方只提供该能力契约。
export function registerModelHandlers(handlers: IModelHandlers) {
    setSForgeState(SForgeSymbols.MODEL_HANDLERS, handlers);
}

/** 获取已注册能力；缺失或结构错误时明确抛错，避免 WebSocket 消息静默丢失。 @显式返回类型原因 对外注册表必须固定返回完整处理器契约。 */
export function getModelHandlers(): IModelHandlers {
    const handlers = getSForgeState(SForgeSymbols.MODEL_HANDLERS);
    if (!isModelHandlers(handlers)) {
        throw new Error("Model handlers not registered. Call registerModelHandlers() before creating Model instances.");
    }
    return handlers;
}
