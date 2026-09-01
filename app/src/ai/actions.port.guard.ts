/** 校验 AI 动作端口注册值。 */
/** 用途：读取端口的函数契约；使用范围：仅限全局注册值的类型守卫边界。 */
import type {AIActionsHandler} from "./actions.port.types";

/** 作用：确认注册值是可调用的 AI 动作处理器；意图：在全局端口边界收窄未知值；调用时机：读取 AI 端口时。 */
export const isAIActionsHandler = (value: unknown): value is AIActionsHandler => {
    return typeof value === "function";
};
