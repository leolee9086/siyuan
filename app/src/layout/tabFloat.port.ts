/** 用途：访问跨入口共享的宿主 Port；使用范围：读取和写入页签 Dialog 浮窗能力；解耦评估：状态访问集中在 Symbol 注册表，不能由菜单参数替代，否则会重新引入具体宿主依赖。 */
import {getSForgeState, setSForgeState} from "../config/sforge.global";
/** 用途：提供页签浮窗 Port 的全局 Symbol；使用范围：完整 App 与独立宿主注册/清理能力；解耦评估：Symbol 是运行时边界契约，保持稳定比直接依赖 Dialog 实现更低耦合。 */
import {SForgeSymbols} from "../config/sforge.symbols";
/** 用途：声明菜单请求接收的 Tab 句柄；使用范围：Port 调用边界；解耦评估：type-only 导入被擦除，运行时由事件或宿主实现处理。 */
import type {Tab} from "./Tab";
/** 用途：共享浮窗 Port 与事件载荷类型；使用范围：菜单、完整 App 适配器和外部宿主；解耦评估：纯类型依赖，事件载荷不携带 DOM/具体 Dialog。 */
import type {ILayoutTabFloatPort, ILayoutTabFloatRequest} from "./tabFloat.types";
/** 用途：提供经过 Zod 校验的共享请求事件；使用范围：无 Port 时的外部宿主委托；解耦评估：事件工厂隔离发射器实例，Port 层不直接实例化第三方对象。 */
import {tabFloatEvents} from "./tabFloat.events.factory";

/** 导出浮窗能力和请求事件的公共类型。 */
export type {ILayoutTabFloatPort, ILayoutTabFloatRequest} from "./tabFloat.types";

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

/** 订阅未注册宿主时的页签浮窗请求。 */
/** @同步豁免: 生命周期 - 订阅必须立即返回取消函数，才能由宿主掌握监听器生命周期。 */
// @柯里化
export const subscribeTabFloatRequest = (listener: (request: ILayoutTabFloatRequest) => void | Promise<void>) =>
    tabFloatEvents.subscribe("tab-open-as-dialog-requested", listener);

/**
 * 请求将页签作为副本放入 Dialog 浮窗。
 * 已注册能力优先执行；没有能力时通过类型化事件交给外部宿主。
 */
/** @同步豁免: UI构建 - 菜单动作必须在菜单关闭前同步发起宿主能力或事件请求，避免丢失当前 Tab 句柄。 */
export const requestOpenTabAsDialog = (tab: Tab) => {
    const port = getLayoutTabFloatPort();
    if (port) {
        return port.open(tab);
    }

    return tabFloatEvents.emit("tab-open-as-dialog-requested", {
        tabId: tab.id,
        title: tab.title || "",
        source: "tab-menu",
    });
};
