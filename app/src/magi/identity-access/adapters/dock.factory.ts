/** 用途：思源宿主类型；使用范围：Dock 模型；解耦评估：跨目录依赖由 adapters 网关集中转发。 */
import * as imports from "./imports";

/** 初始化 Dock 的 Custom Model 内容并绑定销毁逻辑。 */
function initDock(custom: imports.Custom) {
    if (!(custom.element instanceof HTMLElement)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "magi-identity-access-dock");
    const mounted = imports.mountIdentityAccess(custom.element, { hostKind: "dock" });
    custom.destroy = mounted.unmount;
}

/**
 * 作用：创建 Identity Access 原生 Dock 模型。
 * 意图：让标准思源 Dock 生命周期托管共享 Vue 面板。
 * 调用时机：Dock 工厂解析 magi-identity-access 类型时调用。
 */
/** @同步豁免: UI构建 */
export function createIdentityAccessDockModel(app: imports.App, tab: imports.Tab) {
    return new imports.Custom({
        app,
        type: "magi-identity-access",
        tab,
        data: {},
        init: initDock,
    });
}
