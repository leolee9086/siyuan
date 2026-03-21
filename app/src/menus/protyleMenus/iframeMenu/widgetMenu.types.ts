/**
 * 挂件 gutter 菜单扩展事件名。
 *
 * 用途：供主程序与挂件 iframe 约定同一事件通道。
 * 使用场景：打开挂件块 gutter 菜单时，主程序派发该事件，挂件通过监听并注入菜单项。
 * 关联类型：`WidgetGutterMenuEventDetail`
 * 问题/改进：当前为字符串常量协议，后续可考虑集中到公共事件常量模块。
 */
export const WIDGET_GUTTER_MENU_EVENT = "siyuan-widget-block-gutter-menu";

/**
 * 挂件 gutter 菜单扩展事件明细。
 *
 * 用途：承载挂件菜单扩展所需上下文和注入能力。
 * 使用场景：主程序派发到主窗口与挂件 iframe 窗口时作为 `detail`。
 * 关联类型：`WIDGET_GUTTER_MENU_EVENT`
 * 问题/改进：当前依赖 `IMenu` 动态结构，未来可进一步收敛到更严格 schema。
 */
export type WidgetGutterMenuEventDetail = {
    protyle: IProtyle;
    blockElement: Element;
    iframeElement: HTMLIFrameElement;
    widgetId: string;
    iframeSrc: string;
    browserURL: string;
    menuItems: IMenu[];
    append: (menuItem: IMenu) => void;
};
