/** 用途：提供移动设置打开能力的纯类型契约；使用范围：注册值运行时收窄；解耦评估：type-only 依赖不加载菜单或设置实现，守卫与业务隔离。 */
import type {MobileSettingOpener} from "./setting.port.types";

/** 判断注册值是否符合移动设置打开能力契约。 */
/** @同步豁免: 类型守卫 - 必须在返回前完成函数值收窄，调用方才能安全执行注册能力。 */
export const isMobileSettingOpener = (value: unknown): value is MobileSettingOpener => {
    return typeof value === "function";
};
