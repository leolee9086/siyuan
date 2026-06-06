/** 用途：读取块属性接口。使用范围：openBy 子菜单里的 attr 项。解耦评估：接口访问继续走共享网关即可。 */
import { fetchPost } from "./imports";
/** 用途：判断移动端布局。使用范围：决定是否展示 openBy 子菜单。解耦评估：平台判断属于环境能力，不应在子模块自建。 */
import { isMobile } from "./imports";
/** 用途：引用菜单实例类型。使用范围：appendOpenByMenu 参数。解耦评估：菜单实例由入口创建，子模块只消费其接口。 */
import { Menu } from "./imports";
/** 用途：生成“打开方式”子菜单。使用范围：桌面端单选 attached 记录。解耦评估：菜单内容协议由菜单工具维护更稳定。 */
import { openEditorTab } from "./imports";
/** 用途：打开块属性面板。使用范围：openBy->attr 菜单项。解耦评估：属性面板属于全局能力，继续通过网关接入即可。 */
import { openFileAttr } from "./imports";
/** 用途：读取菜单文案。使用范围：openBy 与 attr 菜单项。解耦评估：文案对象经共享网关转发即可。 */
import { siyuanI18n } from "./imports";
/** 用途：读取右键菜单共享上下文类型。使用范围：openBy 菜单追加阶段。解耦评估：类型集中在同层 types.ts 能避免局部重复定义。 */
import type { AttrViewContextmenuState } from "./types";

/**
 * 作用：请求并打开当前主键块的属性面板。
 * 意图：保持原有 openBy->attr 菜单项行为，同时把异步请求集中到单独 handler 中。
 * 调用时机：openBy 子菜单里的 attr 菜单项点击后调用。
 * 问题/改进：当前没有对空 blockId 做额外提示，仍与旧行为一致地直接短路。
 */
const handleOpenBlockAttr = (protyle: IProtyle, blockId: string) => {
    if (!blockId) {
        return;
    }
    fetchPost("/api/attr/getBlockAttrs", { id: blockId }, (response) => {
        openFileAttr(response.data, "av", protyle);
    });
};

/**
 * 作用：向右键菜单追加 openBy 子菜单。
 * 意图：仅在桌面端、单选且主键块未 detached 时暴露“打开方式”入口，保持原菜单行为。
 * 调用时机：`avContextmenu` 构建主菜单后，在 copy 子菜单前调用。
 * 问题/改进：当前仍复用 openEditorTab 返回的菜单项结构，若未来 openBy 菜单协议变化，需要同步调整。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const appendOpenByMenu = (menu: Menu, protyle: IProtyle, state: AttrViewContextmenuState) => {
    if (isMobile || state.selectedRows.length !== 1 || state.keyRow.isDetached || !state.keyRow.blockId) {
        return;
    }
    const openSubmenus = openEditorTab(protyle.app, [state.keyRow.blockId], undefined, undefined, true);
    if (!openSubmenus) {
        return;
    }
    openSubmenus.push({ id: "separator_3", type: "separator" });
    openSubmenus.push({
        id: "attr",
        icon: "iconAttr",
        label: siyuanI18n.attr,
        /** 点击 attr 菜单项时，异步请求块属性数据并打开属性面板 */
        click: () => {
            handleOpenBlockAttr(protyle, state.keyRow.blockId);
        },
    });
    menu.addItem({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: "iconOpen",
        submenu: openSubmenus,
    });
};
