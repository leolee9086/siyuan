/** 用途：思源页签与环境能力；使用范围：打开入口；解耦评估：跨目录依赖由 adapters 网关集中转发。 */
import * as imports from "./imports";

/** 作用：激活已存在的 Identity Access 页签；意图：维持单实例入口；调用时机：新建前查重复时。 */
function activateExistingTab(model: unknown) {
    if (!model || typeof model !== "object") {
        return false;
    }
    const parent = Reflect.get(model, "parent");
    const headElement = parent && typeof parent === "object" ? Reflect.get(parent, "headElement") : null;
    const stack = parent && typeof parent === "object" ? Reflect.get(parent, "parent") : null;
    const switchTab = stack && typeof stack === "object" ? Reflect.get(stack, "switchTab") : null;
    const showHeading = stack && typeof stack === "object" ? Reflect.get(stack, "showHeading") : null;
    if (!headElement || typeof switchTab !== "function" || typeof showHeading !== "function") {
        return false;
    }
    switchTab.call(stack, headElement);
    showHeading.call(stack);
    return true;
}

/** 作用：解析可用 App；意图：兼容显式调用和全局应用上下文；调用时机：打开 Tab 前。 */
function resolveApp(app?: imports.AppFacade) {
    return app ?? imports.getSiyuanWebSocket()?.app;
}

/** 仅匹配 Tab 宿主，避免同类型的 Dock Custom Model 被误判为已打开页签。 */
function isMountedIdentityAccessTab(item: imports.CustomDomain) {
    if (item.type !== imports.MAGI_IDENTITY_ACCESS_TAB_TYPE) {
        return false;
    }
    const element = Reflect.get(item, "element");
    return element instanceof HTMLElement && element.classList.contains("identity-access-container--tab");
}

/** 查找已挂载的 Identity Access Tab，供打开入口执行单实例复用。 */
function findExistingIdentityAccessTab(app: imports.AppFacade) {
    return app.getOpenModels().custom.find(isMountedIdentityAccessTab);
}

/**
 * 作用：打开或激活 Identity Access 笔记 Tab。
 * 意图：为 Agent 和其它主界面入口提供容器中立的登录界面。
 * 调用时机：用户触发身份入口时调用；无 App 上下文则回退独立页面。
 */
export async function openIdentityAccessTab(options?: { app?: imports.AppFacade }) {
    const app = resolveApp(options?.app);
    if (!app) {
        openIdentityAccessStandalone();
        return;
    }
    const existing = findExistingIdentityAccessTab(app);
    if (activateExistingTab(existing)) {
        return;
    }
    await app.openTab({
        custom: {
            title: "Identity Access",
            icon: "iconLock",
            id: imports.MAGI_IDENTITY_ACCESS_TAB_TYPE,
            data: {hostKind: "tab"},
        },
    });
}

/**
 * 作用：打开或聚焦独立 Identity Access Web 页面。
 * 意图：支持 MAGI 独立 renderer、移动端和无 Tab 上下文环境。
 * 调用时机：MAGI 缺少身份或 Tab 入口无法解析 App 时调用。
 */
export async function openIdentityAccessStandalone() {
    const standaloneWindow = window.open("/stage/build/magi-identity/", "magi-identity-access");
    standaloneWindow?.focus();
    return standaloneWindow;
}
