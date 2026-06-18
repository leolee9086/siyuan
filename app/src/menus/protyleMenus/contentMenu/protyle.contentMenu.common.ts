/**
 * 用途：构建菜单项实例
 * 使用范围：全选菜单项创建
 * 解耦评估：通过 imports.ts 转发，组件依赖集中管理
 */
import { MenuItem } from "./imports";
/**
 * 用途：访问全局菜单单例
 * 使用范围：追加全选菜单项
 * 解耦评估：通过 imports.ts 转发，菜单依赖边界清晰
 */
import { getSiyuanGlobalMenus } from "./imports";
/**
 * 用途：读取国际化文案
 * 使用范围：全选菜单文案渲染
 * 解耦评估：通过 imports.ts 转发，i18n 来源统一
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：执行全选
 * 使用范围：selectAll 菜单项点击动作
 * 解耦评估：通过 imports.ts 转发，选区能力与菜单逻辑解耦
 */
import { selectAll } from "./imports";
/**
 * 用途：触发插件菜单事件
 * 使用范围：内容菜单构建完成后通知插件追加菜单项
 * 解耦评估：通过 imports.ts 转发，事件总线与业务流程解耦
 */
import { emitOpenMenu } from "./imports";

/**
 * 添加全选菜单项。
 * @同步豁免: UI构建 - 菜单项需在当前构建周期同步追加。
 */
export const 添加全选菜单 = (protyle: IProtyle, nodeElement: Element, range: Range, captionElement: false | HTMLElement) => {
    // 表格caption内不显示全选菜单，避免在表格标题中触发全选操作
    if (captionElement) {
        return;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "selectAll",
        label: siyuanI18n.selectAll,
        icon: "iconSelect",
        accelerator: "⌘A",
        /** 全选当前块的内容 */
        click() {
            selectAll(protyle, nodeElement, range);
        }
    }).element);
};

/**
 * 触发插件菜单打开事件。
 * @同步豁免: UI构建 - 插件菜单扩展点需在当前菜单构建流程同步触发。
 */
export const 触发插件菜单事件 = (protyle: IProtyle, nodeElement: Element, range: Range) => {
    if (!protyle?.app?.plugins) {
        return;
    }
    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "open-menu-content",
        detail: {
            protyle,
            range,
            element: nodeElement,
        },
        separatorPosition: "top",
    });
};
