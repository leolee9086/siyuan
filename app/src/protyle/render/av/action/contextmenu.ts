/** 用途：隐藏旧浮层。使用范围：属性视图右键菜单打开前。解耦评估：右键菜单构建前统一清理 UI 状态能避免各子模块重复处理。 */
import { hideElements } from "./contextmenu/imports";
/** 用途：创建右键菜单实例。使用范围：属性视图右键菜单入口。解耦评估：菜单实例只在入口层创建，子模块只负责追加菜单项。 */
import { Menu } from "./contextmenu/imports";
/** 用途：读取国际化文案。使用范围：copy 主菜单文案。解耦评估：文案只在入口层拼装一次，继续经子目录 imports.ts 获取即可。 */
import { siyuanI18n } from "./contextmenu/imports";
/** 用途：向插件系统广播菜单扩展事件。使用范围：右键菜单主项构建完成后。解耦评估：插件扩展点应留在入口层统一触发，避免子模块重复发射。 */
import { emitOpenMenu } from "./contextmenu/imports";
/** 用途：准备右键菜单共享上下文。使用范围：入口在真正构建菜单前收敛选中范围和视图信息。解耦评估：共享上下文先收口后再分发，能明显降低子模块耦合。 */
import { prepareContextmenuState } from "./contextmenu/selection";
/** 用途：追加 openBy 子菜单。使用范围：桌面端单选 attached 记录。解耦评估：openBy 与其它菜单段相互独立，拆成独立模块更利于维护。 */
import { appendOpenByMenu } from "./contextmenu/openBy";
/** 用途：构建复制子菜单。使用范围：右键菜单 copy 项。解耦评估：复制逻辑较多且格式规则统一，独立模块更容易审计。 */
import { buildCopyMenu } from "./contextmenu/copy";
/** 用途：追加可编辑菜单项。使用范围：非禁用状态下的 add/delete/fields 等菜单。解耦评估：把修改型动作集中下沉后，入口只保留调度职责。 */
import { appendEditableContextmenuItems } from "./contextmenu/rowActions";

/**
 * 作用：向插件系统发出属性视图右键菜单扩展事件。
 * 意图：保持原有插件扩展入口，同时把插件相关条件判断从主入口里收走。
 * 调用时机：主菜单项构建完成、菜单真正弹出前调用。
 * 问题/改进：当前扩展载荷仍然直接暴露 DOM 节点数组，未来可考虑提供更稳定的菜单上下文结构。
 */
const emitAttrViewContextmenuEvent = (protyle: IProtyle, state: ReturnType<typeof prepareContextmenuState>) => {
    if (!state || !protyle.app?.plugins) {
        return;
    }
    const selectRowElements = state.selectedRows.map((selectedRow) => selectedRow.rowElement);
    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "open-menu-av",
        detail: {
            protyle,
            element: state.blockElement,
            selectRowElements,
        },
        separatorPosition: "top",
    });
};

/**
 * 作用：构建属性视图右键菜单。
 * 意图：在保持 `action.ts.backup.ts` 原始菜单行为的前提下，把复制、openBy 和修改型动作拆到独立子模块。
 * 调用时机：属性视图行或卡片触发 contextmenu 时调用。
 * 问题/改进：当前仍以 DOM 为主驱动菜单上下文，后续如 AV 组件化可继续往显式状态模型迁移。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const avContextmenu = (
    protyle: IProtyle,
    rowElement: HTMLElement | undefined,
    position: IPosition,
    options?: {blockElement?: HTMLElement; anchorElement?: HTMLElement},
) => {
    hideElements(["hint"], protyle);
    const state = prepareContextmenuState(rowElement, options);
    if (!state) {
        return false;
    }
    const menu = new Menu();
    appendOpenByMenu(menu, protyle, state);
    menu.addItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        type: "submenu",
        submenu: buildCopyMenu(state),
    });
    appendEditableContextmenuItems(menu, protyle, state);
    emitAttrViewContextmenuEvent(protyle, state);
    menu.open(position);
    return true;
};
