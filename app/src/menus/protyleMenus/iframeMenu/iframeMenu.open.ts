/**
 * 用途：判断是否 Electron 环境
 * 使用范围：浏览器打开动作中区分 Electron 与浏览器实现
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { isElectron } from "./imports";
/**
 * 用途：Electron 外链打开能力
 * 使用范围：浏览器打开动作
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { openExternal } from "./imports";
/**
 * 用途：浏览器/移动端外链打开能力
 * 使用范围：非 Electron 环境的浏览器打开动作
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { openByMobile } from "./imports";
/**
 * 用途：复用 Bazaar source 自定义页签类型
 * 使用范围：在新页签打开动作（应用内 Tab）
 * 解耦评估：菜单只依赖完整 AppFacade 的页签能力和不可变类型常量，不加载 Bazaar 业务入口
 */
import { BAZAAR_SOURCE_TAB_TYPE } from "./imports";
/**
 * 用途：读取当前页面 origin
 * 使用范围：拼接相对地址为可直接打开的绝对地址
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { getLocationOrigin } from "./imports";
/**
 * 用途：显示错误提示
 * 使用范围：Electron 打开外链失败时反馈
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { showMessage } from "./imports";
/**
 * 用途：读取国际化文案
 * 使用范围：打开菜单项 label
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { siyuanI18n } from "./imports";

/**
 * 规范化 iframe 源地址为可直接打开的 URL。
 *
 * 作用：把相对路径补全为绝对地址，并兼容无协议域名写法（如 `www.example.com`）。
 * 意图：统一“在浏览器打开/在新页签打开”的目标链接，避免不同数据格式导致行为不一致。
 * 调用时机：iframe/widget gutter 菜单构建打开动作前。
 * 问题/改进：对极端自定义协议仅做透传，不做协议白名单校验。
 */
/** @同步豁免: UI构建 — 打开菜单时需要同步计算链接目标 */
export const normalizeIframeOpenURL = (src: string): string => {
    const trimmedSrc = src.trim();
    // 空地址不生成打开动作
    if (!trimmedSrc) {
        return "";
    }

    const hasProtocol = /^[a-z][a-z\d+\-.]*:/i.test(trimmedSrc);
    const isPathLike = trimmedSrc.startsWith("/")
        || trimmedSrc.startsWith("./")
        || trimmedSrc.startsWith("../")
        || trimmedSrc.startsWith("assets/")
        || trimmedSrc.startsWith("widgets/");
    // 协议链接或路径链接都尝试标准化为绝对 URL
    if (hasProtocol || isPathLike) {
        try {
            return new URL(trimmedSrc, getLocationOrigin()).toString();
        } catch (error) {
            return trimmedSrc;
        }
    }

    return `https://${trimmedSrc}`;
};

/**
 * 为挂件打开地址附加挂件块 id。
 *
 * 作用：在 URL 查询参数中写入 `id=<widgetBlockId>`。
 * 意图：让挂件在独立网页模式下也能识别当前挂件块上下文。
 * 调用时机：widget gutter 菜单构建打开动作前。
 * 问题/改进：当前参数名固定为 `id`，后续若有协议变更需同步。
 */
/** @同步豁免: UI构建 — 菜单构建阶段需同步生成可打开链接 */
export const buildWidgetBrowserURL = (src: string, widgetID: string): string => {
    const openURL = normalizeIframeOpenURL(src);
    if (!openURL) {
        return "";
    }
    try {
        const url = new URL(openURL, getLocationOrigin());
        url.searchParams.set("id", widgetID);
        return url.toString();
    } catch (error) {
        const separator = openURL.includes("?") ? "&" : "?";
        return `${openURL}${separator}id=${encodeURIComponent(widgetID)}`;
    }
};

/**
 * 以“在浏览器中查看”方式打开链接。
 *
 * 作用：Electron 走 `openExternal`，非 Electron 走 `openByMobile`。
 * 意图：复用现有平台兼容策略，避免在业务层重复分支。
 * 调用时机：点击 iframe/widget 菜单里的“在浏览器中查看”时。
 * 问题/改进：非 Electron 场景依赖 `openByMobile` 兜底行为。
 */
const openByBrowser = (url: string): void => {
    if (isElectron) {
        openExternal(url).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            showMessage(message);
        });
        return;
    }
    openByMobile(url);
};

/**
 * 以“在应用内新页签”方式打开链接。
 *
 * 作用：复用已注册的第三方源页签模型，在应用内创建/激活一个内嵌 iframe 页签。
 * 意图：保证“在新页签中打开”语义与应用内 Tab 一致，而不是浏览器新页面。
 * 调用时机：点击 iframe/widget 菜单里的“在新页签中打开”时。
 * 问题/改进：当前复用 bazaar-source-tab 作为通用 URL 承载页签，后续可抽离独立通用 URL Tab 类型。
 */
const openInAppTab = async (app: IProtyle["app"], url: string): Promise<void> => {
    await app.openTab({
        custom: {
            title: url,
            icon: "iconLink",
            id: BAZAAR_SOURCE_TAB_TYPE,
            data: {
                sourceID: `iframe-source:${url}`,
                sourceName: url,
                sourceURL: url,
            },
        },
    });
};

/**
 * 构建 iframe/widget 的打开动作菜单。
 *
 * 作用：返回“在浏览器中查看”和“在新页签中打开”两个菜单项。
 * 意图：统一 iframe 与 widget 的打开动作定义，减少重复。
 * 调用时机：iframe/widget gutter 菜单生成时。
 * 问题/改进：当前在应用内新页签动作复用了第三方源页签模型，后续可考虑抽离独立通用 URL Tab。
 *
 * @同步豁免: UI构建 — 菜单项数组需同步返回供上层菜单系统组装
 */
export const buildIframeOpenMenus = (app: IProtyle["app"], url: string): IMenu[] => {
    if (!url) {
        return [];
    }
    return [{
        id: "openInBrowser",
        icon: "iconLanguage",
        label: siyuanI18n.useBrowserView,
        /** @简洁函数 菜单的click回调 */
        click() {
            openByBrowser(url);
        }
    }, {
        id: "openInNewTab",
        icon: "iconOpen",
        label: siyuanI18n.openInNewTab,
        /** @简洁函数 菜单的click回调 */
        click() {
            void openInAppTab(app, url);
        }
    }];
};
