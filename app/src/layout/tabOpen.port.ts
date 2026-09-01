/** Layout 普通 Tab 能力的 Port 边界。 */
/** 用途：读取当前宿主普通 Tab 打开能力状态；使用范围：Port 查询；解耦评估：经同层 gateway 访问全局 Symbol 注册表，避免业务文件跨目录导入。 */
import {getSForgeState} from "./imports";
/** 用途：写入当前宿主普通 Tab 打开能力状态；使用范围：宿主注册与清理；解耦评估：经同层 gateway 访问全局 Symbol 注册表。 */
import {setSForgeState} from "./imports";
/** 用途：提供普通 Tab 打开 Port 的全局 Symbol；使用范围：完整 App 与独立宿主注册/清理能力；解耦评估：经同层 gateway 转发稳定身份键。 */
import {SForgeSymbols} from "./imports";
/** 用途：声明菜单请求接收的 Tab 句柄；使用范围：Port 调用边界；解耦评估：type-only 导入被擦除，运行时由宿主实现处理。 */
import type {ILayoutTabHandle} from "./tabFloat.types";
/** 用途：共享普通 Tab Port 载荷类型；使用范围：Port 打开参数；解耦评估：纯类型依赖。 */
import type {ILayoutTabOpenRequest} from "./tabOpen.types";
/** 用途：共享普通 Tab Port 类型；使用范围：导出与宿主能力契约；解耦评估：纯类型依赖。 */
import type {ILayoutTabOpenPort} from "./tabOpen.types";
/** 用途：在 Port 边界把全局 Symbol 注册表的弱类型值恢复为强类型能力契约；使用范围：Port 读取；解耦评估：类型守卫集中在 guard 文件，避免业务文件直接断言。 */
import {asLayoutTabOpenPort, buildTabOpenRequest} from "./tabOpen.guard";

/** 导出普通 Tab 打开能力和请求载荷的公共类型。 */
export type {ILayoutTabOpenPort, ILayoutTabOpenRequest} from "./tabOpen.types";

/** 获取当前宿主的普通 Tab 打开能力。 */
/** @同步豁免: 生命周期 - 菜单点击前必须同步读取当前宿主能力，不能通过异步事件延迟读取注册状态。 */
/** @显式返回类型原因: 全局 Symbol 键无法保留字面量类型，推导会退化为全状态大联合，Port 边界必须固定为强类型能力契约，调用方才能获得确定签名。 */
// @柯里化
export const getLayoutTabOpenPort = (): ILayoutTabOpenPort | undefined =>
    // Symbol 键在全局注册表中是弱类型契约，Port 边界负责恢复强类型能力声明。
    asLayoutTabOpenPort(getSForgeState(SForgeSymbols.TAB_OPEN_PORT));

/** 注册完整 App 或独立宿主提供的普通 Tab 打开能力。 */
/** @同步豁免: 生命周期 - 宿主初始化阶段必须立即写入能力，确保后续菜单点击不会观察到未注册状态。 */
// @柯里化
export const setLayoutTabOpenPort = (port: ILayoutTabOpenPort) => {
    setSForgeState(SForgeSymbols.TAB_OPEN_PORT, port);
};

/** 清除普通 Tab 打开能力，供宿主销毁和测试隔离使用。 */
/** @同步豁免: 生命周期 - 销毁和测试清理需要在返回前完成状态隔离。 */
// @柯里化
export const resetLayoutTabOpenPort = () => {
    setSForgeState(SForgeSymbols.TAB_OPEN_PORT, undefined);
};

/** 普通 Tab 打开请求的订阅集合，供无宿主或宿主拒绝时的事件回退。 */
const tabOpenRequestListeners = new Set<(request: ILayoutTabOpenRequest) => void>();

/**
 * 订阅普通 Tab 打开请求的验证后事件。
 * 宿主未注册或返回 false 时，requestOpenTabAsTab 会构造 ILayoutTabOpenRequest 并同步分发给所有订阅者。
 * 返回的函数用于取消订阅。
 */
/** @同步豁免: 事件订阅 - 订阅必须同步注册，确保同一 tick 内的请求不会丢失监听。 */
export const subscribeTabOpenRequest = (
    listener: (request: ILayoutTabOpenRequest) => void
) => {
    tabOpenRequestListeners.add(listener);
    return () => {
        tabOpenRequestListeners.delete(listener);
    };
};

/** 向所有订阅者同步分发验证后的请求。 */
const emitTabOpenRequest = (request: ILayoutTabOpenRequest): void => {
    for (const listener of tabOpenRequestListeners) {
        listener(request);
    }
};

/**
 * 请求将页签作为独立普通 Tab 副本打开。
 * mode 为 "copy" 时复制当前会话，为 "new" 时创建空白会话副本。
 * 宿主未注册或拒绝处理时通过订阅事件回退，并返回 true 表示已处理。
 */
/** @同步豁免: UI构建 - 菜单动作必须在菜单关闭前同步发起宿主能力请求，避免丢失当前 Tab 句柄。 */
export const requestOpenTabAsTab = (
    tab: ILayoutTabHandle,
    source: ILayoutTabOpenRequest["source"] = "agent-dock",
    mode: ILayoutTabOpenRequest["mode"] = "copy"
) => {
    const port = getLayoutTabOpenPort();
    if (port !== undefined) {
        const result = port.open(tab, source, mode);
        if (result instanceof Promise) {
            // 宿主异步拒绝时回退到事件；同步返回 true 表示已接管，false 时立即回退。
            // 保持与同步分支一致的返回值语义：已接管返回 true，未接管通过事件返回 true。
            void result.then((resolved) => {
                if (resolved === false) {
                    const request = buildTabOpenRequest(tab, source, mode);
                    if (request) {
                        emitTabOpenRequest(request);
                    }
                }
            });
            // 同步路径已接管，返回 true 避免调用方重复处理
            return true;
        }
        if (result !== false) {
            return result === true ? true : true;
        }
    }
    const request = buildTabOpenRequest(tab, source, mode);
    if (!request) {
        return false;
    }
    emitTabOpenRequest(request);
    return true;
};
