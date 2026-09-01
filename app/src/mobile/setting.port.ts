/** 用途：提供移动设置端口的强类型契约；使用范围：读取、注册和菜单宿主调用；解耦评估：纯类型依赖，不加载设置装配实现。 */
import type {MobileSettingOpener} from "./setting.port.types";
/** 用途：收窄全局 Symbol 注册值；使用范围：端口读取边界；解耦评估：guard 独立于菜单实现，避免端口反向依赖高层模块。 */
import {isMobileSettingOpener} from "./setting.port.guard";

/** 移动设置打开能力的跨模块注册键。 */
const mobileSettingKey = Symbol.for("sforge.mobile.openSetting");

/** 未装配移动设置菜单时的明确回退。 */
const ignoreMobileSetting: MobileSettingOpener = () => undefined;

/** 读取当前宿主的移动设置打开能力。 */
/** @同步豁免: 生命周期 - 设置动作触发前必须同步读取当前注册能力，不能延迟到异步事件。 */
export const getMobileSettingOpener = () => {
    const value = Reflect.get(globalThis, mobileSettingKey);
    if (isMobileSettingOpener(value)) {
        return value;
    }
    return ignoreMobileSetting;
};

/** 注册移动菜单提供的设置打开能力。 */
/** @同步豁免: 生命周期 - 宿主初始化必须在返回前完成注册，后续设置动作才能立即可用。 */
export const setMobileSettingOpener = (opener: MobileSettingOpener) => {
    if (!Reflect.set(globalThis, mobileSettingKey, opener)) {
        throw new Error("Unable to register mobile setting opener");
    }
};
