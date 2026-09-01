/** 用途：校验跨 HMR 状态注册表；使用范围：移动 Agent 状态读取；解耦评估：运行时守卫隔离于业务装配，避免类型断言掩盖旧状态。 */
import type {MobileAgentChatState} from "./MobileAgentChat.types";

/** 判断未知值是否为可读取属性的对象。 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object";

/** 校验移动 Agent 状态的稳定字段，允许可选实例字段在懒创建前缺失。 */
export const isMobileAgentChatState = (value: unknown): value is MobileAgentChatState => {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.visible === "boolean" && typeof value.running === "boolean";
};
