/**
 * 用途：查找当前 Range 所在的表格单元格标签祖先
 * 使用范围：表格菜单入口仅在 TD/TH 场景下生效
 * 解耦评估：通过本地 imports 转发导入，避免业务文件跨目录耦合
 */
import { hasClosestByTag } from "./imports";
/**
 * 用途：访问全局菜单单例
 * 使用范围：向当前右键菜单追加表格菜单项
 * 解耦评估：通过转发层统一依赖入口，降低路径耦合
 */
import { getSiyuanGlobalMenus } from "./imports";
/**
 * 用途：获取国际化文案
 * 使用范围：表格“更多”子菜单文案渲染
 * 解耦评估：i18n 依赖统一从转发层接入，便于后续替换
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：构造表格菜单数据
 * 使用范围：生成插入/删除/更多菜单项
 * 解耦评估：由转发层隔离上级菜单模块路径
 */
import { tableMenu } from "./imports";
/**
 * 用途：创建菜单项实例
 * 使用范围：把表格菜单数据渲染到全局菜单
 * 解耦评估：组件依赖经转发层接入，减少直接跨层导入
 */
import { MenuItem } from "./imports";
/**
 * 用途：校验是否为表格单元格元素
 * 使用范围：对 TD/TH 查找结果做类型守卫
 * 解耦评估：类型守卫通过转发层导入，保持依赖边界清晰
 */
import { isHTMLTableCellElement } from "./imports";

/**
 * 添加表格相关菜单项
 *
 * 作用：当右键点击表格时，向上下文菜单中追加插入行列、删除行列以及更多操作等表格专属菜单项。
 * 意图：将表格菜单构建逻辑与内容菜单主流程分离，便于独立维护和测试。
 * 调用时机：用户对可编辑表格块右键时，由 `contentMenu` 在末尾调用。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const 添加表格菜单 = (detail: {
    protyle: IProtyle,
    range: Range,
    element: Element
}) => {
    const { protyle, range, element: nodeElement } = detail;
    const tdElement = hasClosestByTag(range.startContainer, "TD");
    const thElement = hasClosestByTag(range.startContainer, "TH");
    const cellElement = tdElement || thElement;
    if (!isHTMLTableCellElement(cellElement)) {
        return;
    }
    const tableMenus = tableMenu(protyle, nodeElement, cellElement, range);
    // 有插入菜单项时，先加分隔符再追加
    if (tableMenus.insertMenus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "separator_1",
            type: "separator",
        }).element);
        for (const menuItem of tableMenus.insertMenus) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
        }
    }
    // 有删除菜单项时，先加分隔符再追加
    if (tableMenus.removeMenus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "separator_2",
            type: "separator",
        }).element);
        for (const menuItem of tableMenus.removeMenus) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
        }
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "separator_3",
        type: "separator",
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "more",
        type: "submenu",
        icon: "iconMore",
        label: siyuanI18n.more,
        submenu: tableMenus.otherMenus.concat(tableMenus.other2Menus)
    }).element);
};
