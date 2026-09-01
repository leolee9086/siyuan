/** 用途：提供移动 Agent 端口的强类型契约；使用范围：读取、注册和宿主调用；解耦评估：纯类型依赖，不加载移动菜单或 Agent 实现。 */
import type {MobileAgentOpener} from "./agent.port.types";
/** 用途：收窄全局 Symbol 注册值；使用范围：端口读取边界；解耦评估：守卫独立于业务实现，避免在端口中引入高层模块。 */
import {isMobileAgentOpener} from "./agent.port.guard";

/** 移动 Agent 打开能力的跨模块注册键。 */
const mobileAgentOpenKey = Symbol.for("sforge.mobile.openAgent");

/** 未装配移动 Agent 时的明确回退。 */
const ignoreMobileAgentOpen: MobileAgentOpener = () => undefined;

/** 读取当前宿主的移动 Agent 打开能力。 */
/** @同步豁免: 生命周期 - 菜单动作触发前必须同步读取当前注册能力，不能延迟到异步事件。 */
export const getMobileAgentOpen = () => {
    const value = Reflect.get(globalThis, mobileAgentOpenKey);
    if (isMobileAgentOpener(value)) {
        return value;
    }
    return ignoreMobileAgentOpen;
};

/** 注册移动 Agent 面板实现。 */
/** @同步豁免: 生命周期 - 宿主初始化必须在返回前完成注册，后续菜单动作才能立即可用。 */
export const setMobileAgentOpen = (opener: MobileAgentOpener) => {
    if (!Reflect.set(globalThis, mobileAgentOpenKey, opener)) {
        throw new Error("Unable to register mobile Agent opener");
    }
};
