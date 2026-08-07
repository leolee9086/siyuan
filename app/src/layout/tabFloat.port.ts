/** 用途：访问跨入口共享的宿主 Port；使用范围：读取和写入页签 Dialog 浮窗能力；解耦评估：状态访问集中在 Symbol 注册表，不能由菜单参数替代，否则会重新引入具体宿主依赖。 */
/** 用途：布局 Port 状态读取。使用范围：布局能力模块；解耦评估：经同层 gateway 暴露全局状态访问，避免业务文件跨目录导入。 */
import {getSForgeState} from "./imports";
/** 用途：布局 Port 状态写入。使用范围：布局组合根注册能力；解耦评估：经同层 gateway 隔离全局存储实现。 */
import {setSForgeState} from "./imports";
/** 用途：布局 Port Symbol 键。使用范围：拖拽等宿主能力注册；解耦评估：经同层 gateway 转发稳定身份键。 */
import {SForgeSymbols} from "./imports";
/** 用途：声明菜单请求接收的 Tab 句柄；使用范围：Port 调用边界；解耦评估：type-only 导入被擦除，运行时由宿主实现处理。 */
import type {ILayoutTabHandle} from "./tabFloat.types";
/** 用途：共享浮窗 Port 类型；使用范围：菜单、完整 App 适配器和外部宿主；解耦评估：纯类型依赖。 */
import type {ILayoutTabFloatPort} from "./tabFloat.types";

/** 导出浮窗能力公共类型。 */
export type {ILayoutTabFloatPort} from "./tabFloat.types";

/** 获取当前宿主的页签浮窗能力。 */
/** @同步豁免: 生命周期 - 菜单点击前必须同步读取当前宿主能力，不能通过异步事件延迟读取注册状态。 */
// @柯里化
export const getLayoutTabFloatPort = () => getSForgeState(SForgeSymbols.TAB_FLOAT_PORT);

/** 注册完整 App 或独立宿主提供的页签浮窗能力。 */
/** @同步豁免: 生命周期 - 宿主初始化阶段必须立即写入能力，确保后续菜单点击不会观察到未注册状态。 */
// @柯里化
export const setLayoutTabFloatPort = (port: ILayoutTabFloatPort) => {
    setSForgeState(SForgeSymbols.TAB_FLOAT_PORT, port);
};

/** 清除页签浮窗能力，供宿主销毁和测试隔离使用。 */
/** @同步豁免: 生命周期 - 销毁和测试清理需要在返回前完成状态隔离。 */
// @柯里化
export const resetLayoutTabFloatPort = () => {
    setSForgeState(SForgeSymbols.TAB_FLOAT_PORT, undefined);
};

/**
 * 请求将页签作为副本放入 Dialog 浮窗。
 * 已注册能力优先执行；宿主未注册或拒绝处理时返回 false，由调用方决定行为。
 */
/** @同步豁免: UI构建 - 菜单动作必须在菜单关闭前同步发起宿主能力请求，避免丢失当前 Tab 句柄。 */
export const requestOpenTabAsDialog = (tab: ILayoutTabHandle) => {
    const port = getLayoutTabFloatPort();
    // 注册表状态可能未写入任何宿主能力，先通过 in 守卫把联合类型收窄到具备 open 的 Port。
    if (port !== undefined && typeof port === "object" && "open" in port) {
        return port.open(tab);
    }
    return false;
};
