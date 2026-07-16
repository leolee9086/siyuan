/** 用途：构造图片/块菜单项；使用范围：原生菜单接线；解耦评估：菜单对象由宿主统一管理，颜色模块只提供配置。 */
import {MenuItem} from "../../menus/Menu.Item";
/** 用途：打开颜色工具；使用范围：图片和块菜单点击回调；解耦评估：对话框生命周期与菜单构造分离。 */
import {openColorTool} from "./openColorTool";

/** 创建图片菜单中的“识别图片配色”项，并把图片源传给原生面板。 */
export const createImageColorMenuItem = (imgElement: HTMLImageElement) => new MenuItem({
    id: "sforge-image-colors",
    icon: "iconImage",
    label: "识别图片配色",
    click: () => {
        openColorTool(imgElement.currentSrc || imgElement.src);
    },
});

/** 创建块图标菜单中的颜色工具入口，块内图片存在时自动作为初始取色源。 */
export const createBlockColorMenuItem = (nodeElement: Element) => ({
    id: "sforge-block-colors",
    icon: "iconImage",
    label: "打开颜色工具",
    click: () => {
        const image = nodeElement.querySelector("img");
        openColorTool(image instanceof HTMLImageElement ? image.currentSrc || image.src : "");
    },
});
