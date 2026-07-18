/** 用途：Custom Tab 类型；使用范围：Identity Access Tab 初始化；解耦评估：跨目录依赖由 adapters 网关集中转发。 */
import * as imports from "./imports";

/** Identity Access 在 TabRegistry、布局恢复和打开入口中使用的稳定类型标识。 */
export const MAGI_IDENTITY_ACCESS_TAB_TYPE = "magi-identity-access";

/**
 * 作用：在自定义 Tab 的根元素挂载 Identity Access。
 * 意图：让页签恢复和新建走相同生命周期。
 * 调用时机：TabRegistry 创建 magi-identity-access 模型时调用。
 */
/** @同步豁免: UI构建 */
export function initIdentityAccessTab(model: imports.Custom) {
    if (!(model.element instanceof HTMLElement)) {
        return;
    }
    const mounted = imports.mountIdentityAccess(model.element, { hostKind: "tab" });
    model.destroy = mounted.unmount;
}
