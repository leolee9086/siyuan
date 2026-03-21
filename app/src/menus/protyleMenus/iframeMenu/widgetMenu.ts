/**
 * 用途：复用 iframe 块基础菜单构建
 * 使用范围：widgetMenu 先构建基础菜单，再替换打开动作并追加挂件扩展菜单
 * 解耦评估：同目录能力复用，避免复制 iframe src 编辑事务逻辑
 */
import { iframeMenu } from "./iframeMenu";
/**
 * 用途：构建挂件专用打开 URL（附加 widget id）
 * 使用范围：widgetMenu 的“在浏览器中查看/在新页签中打开”动作
 * 解耦评估：打开逻辑在 iframeMenu.open.ts 已独立封装，复用可减少耦合
 */
import { buildWidgetBrowserURL } from "./iframeMenu.open";
/**
 * 用途：构建 iframe/widget 的打开动作菜单项
 * 使用范围：widgetMenu 中追加挂件专属打开动作
 * 解耦评估：打开动作逻辑独立封装，菜单主流程仅负责编排
 */
import { buildIframeOpenMenus } from "./iframeMenu.open";
/**
 * 用途：向主窗口和 iframe 窗口派发自定义事件
 * 使用范围：widgetMenu 中触发挂件菜单扩展事件
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { dispatchCustomEvent } from "./imports";
/**
 * 用途：向主窗口派发自定义事件
 * 使用范围：widgetMenu 中触发挂件菜单扩展事件
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { dispatchWindowCustomEvent } from "./imports";
/**
 * 用途：读取国际化文案
 * 使用范围：widgetMenu 构建“挂件”菜单组标题
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：挂件菜单扩展事件协议类型
 * 使用范围：组装扩展事件 detail
 * 解耦评估：类型独立在 .types.ts，符合业务文件类型定义约束
 */
import { WIDGET_GUTTER_MENU_EVENT } from "./widgetMenu.types";
/**
 * 用途：挂件菜单扩展事件协议类型
 * 使用范围：组装扩展事件 detail
 * 解耦评估：类型独立在 .types.ts，符合业务文件类型定义约束
 */
import type { WidgetGutterMenuEventDetail } from "./widgetMenu.types";

/**
 * 清理基础菜单中的默认打开动作。
 *
 * 作用：移除 `iframeMenu` 中默认的 open 菜单项（openInBrowser/openInNewTab）。
 * 意图：widget 需要使用附带 widget id 的打开链接，因此先移除默认动作再重建。
 * 调用时机：widgetMenu 组装阶段，在追加挂件专用打开动作前执行。
 * 问题/改进：当前通过菜单项 id 匹配，若后续 id 改名需同步。
 */
const removeDefaultOpenMenus = (menus: IMenu[]): IMenu[] => {
    const filteredMenus = menus.filter((item) => item.id !== "openInBrowser" && item.id !== "openInNewTab");
    const lastMenu = filteredMenus[filteredMenus.length - 1];
    // 移除默认打开项后可能遗留末尾分隔符，需清理避免空分组
    if (lastMenu && lastMenu.type === "separator") {
        filteredMenus.pop();
    }
    return filteredMenus;
};

/**
 * 触发挂件菜单扩展事件并收集挂件注入的菜单项。
 *
 * 作用：向主窗口和挂件 iframe 窗口同步派发扩展事件，收集挂件追加的菜单项。
 * 意图：允许挂件块在自身 gutter 菜单中定义个性化操作。
 * 调用时机：widgetMenu 构建完成默认菜单后、返回前。
 * 问题/改进：跨域 iframe 无法派发到 contentWindow，当前直接忽略。
 */
const collectWidgetCustomMenus = (options: {
    protyle: IProtyle;
    nodeElement: Element;
    iframeElement: HTMLIFrameElement;
    widgetID: string;
    iframeSrc: string;
    browserURL: string;
}): IMenu[] => {
    const customMenus: IMenu[] = [];
    const detail: WidgetGutterMenuEventDetail = {
        protyle: options.protyle,
        blockElement: options.nodeElement,
        iframeElement: options.iframeElement,
        widgetId: options.widgetID,
        iframeSrc: options.iframeSrc,
        browserURL: options.browserURL,
        menuItems: customMenus,
        /** 收集挂件注入菜单项 */
        append(menuItem: IMenu) {
            customMenus.push(menuItem);
        }
    };

    dispatchWindowCustomEvent<WidgetGutterMenuEventDetail>(WIDGET_GUTTER_MENU_EVENT, detail);
    const iframeWindow = options.iframeElement.contentWindow;
    // 仅在 iframe 窗口存在时继续向挂件上下文派发事件
    if (iframeWindow) {
        try {
            dispatchCustomEvent<WidgetGutterMenuEventDetail>(iframeWindow, WIDGET_GUTTER_MENU_EVENT, detail);
        } catch (error) {
            // 跨域或异常挂件上下文时忽略，避免影响默认菜单渲染
        }
    }
    return customMenus;
};

/**
 * 构建挂件块菜单。
 *
 * 作用：复用 iframe 菜单基础能力，并追加挂件专用打开动作和挂件扩展菜单事件机制。
 * 意图：保证挂件菜单与 iframe 菜单行为一致，同时支持挂件块上下文能力。
 * 调用时机：gutter 类型菜单分发命中 `NodeWidget` 时。
 * 问题/改进：当前扩展事件是同步收集，若挂件侧存在重计算可能影响菜单打开延迟。
 *
 * @同步豁免: UI构建 — 菜单构建流程要求同步返回菜单项数组
 */
export const widgetMenu = (protyle: IProtyle, nodeElement: Element): IMenu[] => {
    const widgetID = nodeElement.getAttribute("data-node-id");
    const iframeElement = nodeElement.querySelector("iframe");
    // 缺少挂件 id 或 iframe 元素时回退到基础 iframe 菜单
    if (!widgetID || !(iframeElement instanceof HTMLIFrameElement)) {
        return iframeMenu(protyle, nodeElement);
    }

    const menus = removeDefaultOpenMenus(iframeMenu(protyle, nodeElement));
    const iframeSrc = iframeElement.getAttribute("src") || "";
    const browserURL = buildWidgetBrowserURL(iframeSrc, widgetID);
    const widgetOpenMenus = buildIframeOpenMenus(protyle.app, browserURL);
    // 仅在挂件 URL 可用时追加挂件专用打开动作
    if (widgetOpenMenus.length > 0) {
        menus.push({ type: "separator" });
        menus.push(...widgetOpenMenus);
    }

    const customMenus = collectWidgetCustomMenus({
        protyle,
        nodeElement,
        iframeElement,
        widgetID,
        iframeSrc,
        browserURL
    });
    // 有挂件扩展菜单时追加独立分组，避免与默认动作混排
    if (customMenus.length > 0) {
        menus.push({ type: "separator" });
        menus.push({
            id: "widgetCustomMenuGroup",
            type: "submenu",
            icon: "iconBoth",
            label: siyuanI18n.widget,
            submenu: customMenus
        });
    }
    return menus;
};
