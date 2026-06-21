/**
 * 用途：格式化更新时间戳
 * 使用范围：删除行内公式后写入块 updated 字段
 * 解耦评估：通过本地 imports 转发，避免业务文件直接依赖第三方包
 */
import { dayjs } from "./imports";
/**
 * 用途：聚焦指定 Range
 * 使用范围：copy/cut 前将选区定位到当前行内公式
 * 解耦评估：选区能力从转发层接入，降低跨目录耦合
 */
import { focusByRange } from "./imports";
/**
 * 用途：菜单常量
 * 使用范围：设置菜单 data-name 标识
 * 解耦评估：常量依赖经转发层集中管理
 */
import { Constants } from "./imports";
/**
 * 用途：定位当前元素所在块节点
 * 使用范围：删除公式后更新事务依赖块节点信息
 * 解耦评估：DOM 工具能力通过转发层接入，便于维护依赖边界
 */
import { hasClosestBlock } from "./imports";
/**
 * 用途：把光标恢复到插入的 wbr 位置
 * 使用范围：删除公式后恢复编辑态光标
 * 解耦评估：选区工具能力通过转发层接入，减少路径耦合
 */
import { focusByWbr } from "./imports";
/**
 * 用途：提交编辑器事务
 * 使用范围：删除行内公式后写入事务用于撤销重做
 * 解耦评估：事务能力通过转发层接入，保持业务与底层实现解耦
 */
import { updateTransaction } from "./imports";
/**
 * 用途：读取全局菜单实例
 * 使用范围：清空、追加、弹出行内公式菜单
 * 解耦评估：环境能力通过转发层导入，统一依赖入口
 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/**
 * 用途：读取国际化文案
 * 使用范围：copy/cut/remove 菜单项 label
 * 解耦评估：i18n 能力通过转发层导入，来源稳定
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：菜单项构造器
 * 使用范围：构建行内公式菜单项
 * 解耦评估：组件能力通过转发层导入，避免业务文件跨层依赖
 */
import { MenuItem } from "./imports";

/**
 * 作用：在 copy/cut 前聚焦当前行内公式节点并执行命令。
 * 意图：复用 copy 与 cut 的公共逻辑，减少重复代码。
 * 调用时机：copy/cut 菜单项点击时。
 * 问题/改进：仍使用 execCommand，属于兼容路径，后续可评估 Clipboard API 替代。
 */
const 执行复制或剪切命令 = (element: Element, command: "copy" | "cut") => {
    const range = document.createRange();
    range.selectNode(element);
    focusByRange(range);
    document.execCommand(command);
};

/**
 * 作用：删除行内公式并同步事务、恢复光标。
 * 意图：把 remove 菜单点击逻辑集中在单函数，降低主流程复杂度。
 * 调用时机：remove 菜单项点击时。
 * 问题/改进：仍依赖块级 outerHTML 事务模式，后续可评估更细粒度变更接口。
 */
const 执行删除命令 = (
    protyle: IProtyle,
    element: Element,
    nodeElement: Element,
    id: string | null,
    html: string
) => {
    element.insertAdjacentHTML("afterend", "<wbr>");
    element.remove();
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, nodeElement, html);
    const toolbarRange = protyle.toolbar?.range;
    if (toolbarRange) {
        focusByWbr(nodeElement, toolbarRange);
    }
};

/**
 * 作用：追加 copy 菜单项。
 * 意图：把菜单渲染细节从主函数中拆出，降低主函数行数和复杂度。
 * 调用时机：inlineMathMenu 构建菜单时。
 * 问题/改进：暂无。
 */
const 追加复制菜单项 = (element: Element) => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click: 执行复制或剪切命令.bind(null, element, "copy")
    }).element);
};

/**
 * 作用：追加 cut 与 remove 菜单项。
 * 意图：把可编辑态菜单逻辑集中，避免主函数出现长分支。
 * 调用时机：inlineMathMenu 在非禁用状态下构建菜单时。
 * 问题/改进：暂无。
 */
const 追加可编辑菜单项 = (
    protyle: IProtyle,
    element: Element,
    nodeElement: Element,
    id: string | null,
    html: string
) => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        label: siyuanI18n.cut,
        click: 执行复制或剪切命令.bind(null, element, "cut")
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        click: 执行删除命令.bind(null, protyle, element, nodeElement, id, html)
    }).element);
};

/**
 * 作用：构建并弹出行内公式菜单（复制/剪切/删除）。
 * 意图：为行内公式提供统一的上下文菜单入口。
 * 调用时机：用户在行内公式节点触发上下文菜单时。
 * 问题/改进：依赖 execCommand 兼容路径，后续可评估现代剪贴板能力。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const inlineMathMenu = (protyle: IProtyle, element: Element) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_MATH);
    const nodeElement = hasClosestBlock(element);
    if (!nodeElement) {
        return;
    }
    const id = nodeElement.getAttribute("data-node-id");
    const html = nodeElement.outerHTML;
    追加复制菜单项(element);
    if (!protyle.disabled) {
        追加可编辑菜单项(protyle, element, nodeElement, id, html);
    }
    const rect = element.getBoundingClientRect();
    getSiyuanGlobalMenusMenu().popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
};
