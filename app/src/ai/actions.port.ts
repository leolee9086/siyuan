/** 用途：提供 AI 编辑动作的跨域端口；使用范围：工具栏等低层入口；解耦评估：避免编辑器工具链反向加载 AI 装配模块。 */
/** 用途：提供端口处理器契约；使用范围：注册与读取的类型边界；解耦评估：纯类型导入，不加载业务实现。 */
import type {AIActionsHandler} from "./actions.port.types";
/** 用途：验证全局端口值；使用范围：读取端口时的运行时收窄；解耦评估：独立守卫避免依赖 AI 菜单实现。 */
import {isAIActionsHandler} from "./actions.port.guard";

const aiActionsKey = Symbol.for("sforge.ai.actions");
/** 作用：在 AI 尚未装配时忽略动作；意图：让编辑器低层入口保持可用；调用时机：端口读取不到注册实现时。 */
const ignoreAIActions: AIActionsHandler = () => undefined;

/** 读取已装配的 AI 编辑动作；未装配时保持编辑器快捷键可用。 */
/** @显式返回类型原因 端口读取必须稳定暴露统一处理器契约，避免未知全局值泄漏到调用方。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
/** 工具栏点击必须在当前事件循环取得已注册处理器。 */
export const getAIActions = () => {
    const value = Reflect.get(globalThis, aiActionsKey);
    if (isAIActionsHandler(value)) {
        return value;
    }
    return ignoreAIActions;
};

/** 注册 AI 装配模块提供的编辑动作。 */
/** @同步豁免: 生命周期 */
/** AI 模块初始化返回前必须完成端口注册。 */
export const setAIActions = (handler: AIActionsHandler) => {
    if (!Reflect.set(globalThis, aiActionsKey, handler)) {
        throw new Error("Unable to register AI actions handler");
    }
};
