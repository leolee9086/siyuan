/** 用途：应用外观类型。使用范围：拖拽恢复能力的组合根注入；解耦评估：仅类型依赖，不加载 App 实现。 */
import type {AppFacade} from "./imports";
/** 用途：布局拖拽恢复契约。使用范围：Wnd 与组合根；解耦评估：复用布局领域根，避免具体窗口 class。 */
import type {WndDragRestore} from "./imports";
/** 用途：拖拽 Port 状态访问。使用范围：Wnd 构造和组合根注册；解耦评估：同层 gateway 隔离全局状态与 Symbol 实现。 */
import {getSForgeState} from "./imports";
/** 用途：拖拽 Port 状态登记。使用范围：组合根注册能力；解耦评估：同层 gateway 隔离全局状态实现。 */
import {setSForgeState} from "./imports";
/** 用途：拖拽 Port 身份键。使用范围：全局能力槽访问；解耦评估：Symbol 不携带具体实现。 */
import {SForgeSymbols} from "./imports";

/** 用途：Wnd 拖拽恢复能力。使用范围：Wnd 事件绑定与应用组合根；解耦评估：仅传递布局数据和窗口抽象，不加载反序列化实现。 */
/** 在应用组合根登记布局恢复实现，Wnd 构造前必须完成登记。 */
/** @同步豁免: 生命周期 */
// @柯里化
export const configureWndDragRestore = (restore: WndDragRestore<AppFacade>) => {
    setSForgeState(SForgeSymbols.WND_DRAG_RESTORE, restore);
};

/** 获取已登记的恢复能力，缺少装配时显式报告配置错误。 */
/** @同步豁免: 生命周期 */
export const getWndDragRestore = () => {
    const restoreCenter = getSForgeState(SForgeSymbols.WND_DRAG_RESTORE);
    if (!restoreCenter) {
        throw new Error("Wnd drag restore capability is not configured");
    }
    return restoreCenter;
};
