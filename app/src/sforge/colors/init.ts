/** 用途：注册原生状态栏入口；使用范围：颜色工具初始化；解耦评估：状态栏注册由颜色模块网关提供。 */
import {注册状态栏按钮} from "./imports";
/** 用途：打开和查询颜色工具对话框；使用范围：状态栏点击回调；解耦评估：UI 生命周期集中在 openColorTool。 */
import {colorToolIsOpen, openColorTool} from "./openColorTool";
/** 用途：构造原生 Dock 模型；使用范围：s-forge Dock 初始化；解耦评估：Dock 生命周期由宿主管理，颜色面板只负责 Vue 挂载。 */
import {Custom} from "../../layout/dock/Custom";
/** 用途：Dock 模型创建参数类型；使用范围：颜色 Dock 工厂；解耦评估：纯类型依赖。 */
import type {App} from "../../index";
/** 用途：Dock 页签参数类型；使用范围：颜色 Dock 工厂；解耦评估：纯类型依赖。 */
import type {Tab} from "../../layout/Tab";
/** 用途：Vue 挂载和 DOM guard；使用范围：颜色 Dock 初始化；解耦评估：通过颜色网关复用现有挂载能力。 */
import {createVueComponentLoader, isHTMLElement} from "./imports";
/** 用途：颜色工具面板；使用范围：原生 Dock 内容；解耦评估：Dock 和对话框共享同一面板组件。 */
import ColorToolPanel from "./ColorToolPanel.vue";

/** 注册颜色工具状态栏按钮；应用启动时由 S-Forge 通用初始化调用一次。 */
export const initColorTool = (): void => {
    注册状态栏按钮({
        id: "SForgeColors",
        icon: "iconImage",
        tooltip: "颜色工具",
        position: "right",
        order: 45,
        onClick: () => {
            if (colorToolIsOpen()) {
                openColorTool().destroy();
                return;
            }
            openColorTool();
        },
    });
};

/** 为原生 Dock 创建颜色工具 Custom Model，挂载和销毁由 Dock 生命周期驱动。 */
export const createColorToolDockModel = (app: App, tab: Tab) => new Custom({
    app,
    type: "sforge-colors",
    tab,
    data: {},
    init: custom => {
        if (!isHTMLElement(custom.element)) {
            return;
        }
        custom.element.classList.add("fn__flex-column", "sforge-color-dock");
        const vueApp = createVueComponentLoader(custom.element, {
            components: {ColorToolPanel},
            template: "<ColorToolPanel :embedded=\"true\" />",
        });
        custom.destroy = () => vueApp.unmount();
    },
});
