/** 用途：链接事件详情载荷类型。使用范围：普通链接派发和兼容类型导出，不加载运行时代码。 */
import type {IOpenLinkEventDetail} from "./types";
/** 用途：链接事件最小插件宿主协议。使用范围：同步取消派发边界，不依赖完整应用组合根。 */
import type {OpenLinkEventApp} from "./types";

/** 用途：向既有调用方保留链接事件详情类型入口。使用范围：链接插件事件与其单元测试。 */
export type {IOpenLinkEventDetail};

/**
 * 作用：规范化普通链接事件的最终地址，并排除资产链接。
 * 意图：让插件收到一致的可取消链接地址，同时由资产事件保留独立处理路径。
 * 调用时机：编辑器点击链接、且尚未确认它是资产时。
 * 问题/改进：不验证 URL 可达性，只处理省略 scheme 的外链。
 * @显式返回类型原因：插件事件 API 必须稳定表达“资产不派发普通链接事件”的缺失状态。
 * @同步豁免: 生命周期 - 当前点击栈必须立刻取得规范化结果，随后才能决定是否阻止默认导航。
 */
export const resolveOpenLinkEvent = (options: {
    href: string,
    originalHref: string,
    isAsset: boolean,
    isLocal: boolean,
    event?: MouseEvent | KeyboardEvent,
}): IOpenLinkEventDetail | undefined => {
    if (!options.href || options.isAsset) {
        return;
    }
    const href = !options.isLocal && 0 > options.href.indexOf(":") ? `https://${options.href}` : options.href;
    return {href, originalHref: options.originalHref, event: options.event};
};


/**
 * 作用：向插件派发已规范化的普通链接打开事件。
 * 意图：允许插件阻止或观察非资产链接的默认打开行为。
 * 调用时机：编辑器完成链接地址规范化后。
 * 问题/改进：返回 false 表示已有插件取消默认处理。
 * @同步豁免: 生命周期 - 插件取消结果必须在当前点击栈返回，默认链接导航不能等待微任务。
 */
export const emitOpenLink = (app: OpenLinkEventApp, detail: IOpenLinkEventDetail) => {
    for (const plugin of app.plugins) {
        if (!plugin.eventBus.emit("open-link", detail)) {
            return false;
        }
    }
    return true;
};

/**
 * 作用：向插件派发资产打开事件。
 * 意图：资产路径和打开动作需要在默认处理前保留为独立的可取消事件。
 * 调用时机：编辑器根据当前修饰键和配置解析出资产动作后。
 * 问题/改进：返回 false 表示已有插件取消默认处理。
 * @同步豁免: 生命周期 - 插件取消结果必须在当前点击栈返回，默认资产打开不能等待微任务。
 */
export const emitOpenAsset = (options: {
    app: OpenLinkEventApp,
    path: string,
    action: Config.TAssetOpenAction,
    event?: MouseEvent,
}) => {
    const detail = {path: options.path, action: options.action, event: options.event};
    for (const plugin of options.app.plugins) {
        if (!plugin.eventBus.emit("open-asset", detail)) {
            return false;
        }
    }
    return true;
};
