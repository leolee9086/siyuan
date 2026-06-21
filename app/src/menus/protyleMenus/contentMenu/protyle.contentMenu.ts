/** 用途：更新时间字符串。使用范围：行内元素剪切/删除后写入 updated。解耦评估：经 imports.ts 转发。 */
import { dayjs } from "./imports";
/** 用途：聚焦 Range。使用范围：复制/剪切/粘贴前恢复焦点。解耦评估：经 imports.ts 转发。 */
import { focusByRange } from "./imports";
/** 用途：菜单常量。使用范围：设置菜单 data-name。解耦评估：经 imports.ts 转发。 */
import { Constants } from "./imports";
/** 用途：移动端判断。使用范围：移动端 showContent 分支。解耦评估：经 imports.ts 转发。 */
import { isMobile } from "./imports";
/** 用途：复制纯文本。使用范围：copyPlainText 菜单项。解耦评估：经 imports.ts 转发。 */
import { copyPlainText } from "./imports";
/** 用途：写剪贴板文本。使用范围：行内复制/剪切。解耦评估：经 imports.ts 转发。 */
import { writeText } from "./imports";
/** 用途：按标签查祖先。使用范围：行内与 caption 判断。解耦评估：经 imports.ts 转发。 */
import { hasClosestByTag } from "./imports";
/** 用途：获取编辑器 Range。使用范围：复制/剪切/粘贴前取选区。解耦评估：经 imports.ts 转发。 */
import { getEditorRange } from "./imports";
/** 用途：聚焦 wbr。使用范围：行内删除后恢复光标。解耦评估：经 imports.ts 转发。 */
import { focusByWbr } from "./imports";
/** 用途：读取工具栏。使用范围：showContent 与当前类型判断。解耦评估：经 imports.ts 转发。 */
import { getProtyleToolbar } from "./imports";
/** 用途：读取 Lute。使用范围：行内复制/剪切转 Markdown。解耦评估：经 imports.ts 转发。 */
import { getProtyleLute } from "./imports";
/** 用途：提交事务。使用范围：剪切/删除后持久化更新。解耦评估：经 imports.ts 转发。 */
import { updateTransaction } from "./imports";
/** 用途：构建菜单项。使用范围：内容菜单追加操作项。解耦评估：经 imports.ts 转发。 */
import { MenuItem } from "./imports";
/** 用途：访问全局菜单。使用范围：菜单 remove/append/popup。解耦评估：经 imports.ts 转发。 */
import { getSiyuanGlobalMenus } from "./imports";
/** 用途：国际化文案。使用范围：内容菜单文案渲染。解耦评估：经 imports.ts 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：读取配置。使用范围：快捷键显示与粘贴行为判断。解耦评估：经 imports.ts 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：读取 Selection。使用范围：复制纯文本取当前选中内容。解耦评估：经 imports.ts 转发。 */
import { getSelection } from "./imports";
/** 用途：内容菜单上下文类型。使用范围：内容菜单流程参数。解耦评估：经 imports.ts 转发类型。 */
import type { IContentMenuContext } from "./imports";
/** 用途：行内菜单上下文类型。使用范围：行内菜单辅助函数参数。解耦评估：经 imports.ts 转发类型。 */
import type { IInlineMenuContext } from "./imports";
/** 用途：追加表格菜单。使用范围：可编辑表格块右键菜单扩展。解耦评估：经 imports.ts 转发。 */
import { 添加表格菜单 } from "./imports";
/** 用途：追加粘贴菜单。使用范围：可编辑且非 caption 场景。解耦评估：粘贴逻辑拆分到独立模块。 */
import { 添加粘贴菜单 } from "./protyle.contentMenu.paste";
/** 用途：节点类型守卫。使用范围：选区 emoji 判断。解耦评估：类型判断独立在 guard 模块。 */
import { isHTMLElement } from "./protyle.contentMenu.guard";
/** 用途：追加全选菜单。使用范围：非 caption 场景。解耦评估：通用菜单能力拆分到独立模块。 */
import { 添加全选菜单 } from "./protyle.contentMenu.common";
/** 用途：触发插件菜单事件。使用范围：内容菜单构建后插件扩展。解耦评估：通用流程拆分到独立模块。 */
import { 触发插件菜单事件 } from "./protyle.contentMenu.common";


/**
 * 添加有选区时的菜单项（复制、复制纯文本、剪切、删除）
 * @returns 如果 protyle.disabled 为 true 则返回 true，表示应该提前退出
 */
const 添加选区相关菜单 = (ctx: IContentMenuContext): boolean => {
    const { protyle, nodeElement, oldHTML, id, captionElement } = ctx;
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        icon: "iconCopy",
        accelerator: "⌘C",
        label: siyuanI18n.copy,
        /** 复制选中内容到剪贴板 */
        click() {
            focusByRange(getEditorRange(nodeElement));
            document.execCommand("copy");
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copyPlainText",
        label: siyuanI18n.copyPlainText,
        accelerator: getSiyuanConfig().keymap.editor.general.copyPlainText.custom,
        /** 复制选中内容为纯文本（去除格式） */
        click() {
            focusByRange(getEditorRange(nodeElement));
            copyPlainText(getSelection().getRangeAt(0).toString());
        }
    }).element);
    if (protyle.disabled || captionElement) {
        return true;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        accelerator: "⌘X",
        label: siyuanI18n.cut,
        /** 剪切选中内容 */
        click() {
            focusByRange(getEditorRange(nodeElement));
            document.execCommand("cut");
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "delete",
        icon: "iconTrashcan",
        accelerator: "⌫",
        label: siyuanI18n.delete,
        /** 删除选中内容并更新事务 */
        click() {
            const currentRange = getEditorRange(nodeElement);
            currentRange.insertNode(document.createElement("wbr"));
            currentRange.extractContents();
            focusByWbr(nodeElement, currentRange);
            focusByRange(currentRange);
            updateTransaction(protyle, nodeElement, oldHTML);
        }
    }).element);
    return false;
};

/** 添加行内元素的复制菜单项 */
const 添加行内复制菜单 = (protyle: IProtyle, inlineElement: HTMLSpanElement): void => {
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        /** 将行内元素内容转换为 Markdown 并复制 */
        click() {
            writeText(getProtyleLute(protyle).BlockDOM2StdMd(inlineElement.outerHTML));
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copyPlainText",
        label: siyuanI18n.copyPlainText,
        /** 复制行内元素纯文本内容 */
        click() {
            copyPlainText(inlineElement.textContent);
        }
    }).element);
};

/** 添加行内元素的编辑菜单项（剪切、删除） */
const 添加行内编辑菜单 = (ctx: IInlineMenuContext): void => {
    const { protyle, nodeElement, range, oldHTML, inlineElement } = ctx;
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        throw new Error("块元素缺少id");
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        label: siyuanI18n.cut,
        /** 将行内元素转为 Markdown 后剪切，并更新事务 */
        click() {
            writeText(getProtyleLute(protyle).BlockDOM2StdMd(inlineElement.outerHTML));
            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
            inlineElement.remove();
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, nodeElement, oldHTML);
            focusByWbr(nodeElement, getProtyleToolbar(protyle).range ?? range);
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        /** 删除行内元素并更新事务 */
        click() {
            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
            inlineElement.remove();
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, nodeElement, oldHTML);
            focusByWbr(nodeElement, getProtyleToolbar(protyle).range ?? range);
        }
    }).element);
};

/**
 * 添加无选区但在行内元素(code/kbd)上时的菜单项
 * @see https://github.com/siyuan-note/siyuan/issues/9630
 */
const 添加行内元素菜单 = (ctx: IContentMenuContext): void => {
    const { protyle, nodeElement, range, oldHTML } = ctx;
    const inlineElement = hasClosestByTag(range.startContainer, "SPAN");
    if (!inlineElement) {
        return;
    }
    const inlineTypes = getProtyleToolbar(protyle).getCurrentType(range);
    const isCodeOrKbd = inlineTypes.includes("code") || inlineTypes.includes("kbd");
    if (!isCodeOrKbd) {
        return;
    }
    添加行内复制菜单(protyle, inlineElement);
    if (protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({ type: "separator" }).element);
        return;
    }
    添加行内编辑菜单({ protyle, nodeElement, range, oldHTML, inlineElement });
    getSiyuanGlobalMenus().menu.append(new MenuItem({ type: "separator" }).element);
};

/** 检查是否有选区或选中了表情 */
const 检查有选区或表情 = (range: Range): boolean => {
    if (range.toString() !== "") {
        return true;
    }
    const firstChild = range.cloneContents().childNodes[0];
    if (!isHTMLElement(firstChild)) {
        return false;
    }
    return firstChild.classList?.contains("emoji") ?? false;
};

/**
 * 构建 Protyle 内容区域的右键菜单
 *
 * 作用：根据当前选区状态和元素类型，构建相应的上下文菜单
 * 意图：集中管理编辑器内容区右键菜单的构建入口，使各子菜单逻辑保持内聚
 * 调用时机：用户在编辑器内容区域右键点击时
 */
/** @同步豁免: UI构建 — 右键菜单需要在同步调用栈中同步组装所有菜单项，否则菜单将出现闪烁或排序错乱 */
export const contentMenu = (protyle: IProtyle, nodeElement: Element): void => {
    const range = getEditorRange(nodeElement);
    getSiyuanGlobalMenus().menu.remove();
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_INLINE_CONTEXT);
    // 移动端：使用工具栏显示内容菜单
    if (isMobile) {
        getProtyleToolbar(protyle).showContent(protyle, range, nodeElement);
        触发插件菜单事件(protyle, nodeElement, range);
        return;
    }
    // 桌面端：构建完整的上下文菜单
    const oldHTML = nodeElement.outerHTML;
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        throw new Error("块元素缺少id");
    }
    // 检测光标是否在表格caption元素内，用于阻止剪切/删除/粘贴/全选操作
    const captionElement = hasClosestByTag(range.startContainer, "CAPTION");
    const ctx: IContentMenuContext = { protyle, nodeElement, range, oldHTML, id, captionElement };
    const 有选区或表情 = 检查有选区或表情(range);
    // 有选区时展示复制/剪切/删除菜单；选区包含表情时也走此分支，若禁用状态则提前退出
    if (有选区或表情 && 添加选区相关菜单(ctx)) {
        return;
    }
    // 无选区时检测行内元素（code/kbd），显示行内专属菜单
    if (!有选区或表情) {
        添加行内元素菜单(ctx);
    }
    添加粘贴菜单(protyle, nodeElement, captionElement);
    添加全选菜单(protyle, nodeElement, range, captionElement);
    // 仅对可编辑的表格块追加表格操作菜单
    const 是可编辑表格 = nodeElement.classList.contains("table") && !protyle.disabled;
    // 只有表格块且编辑器可编辑时才追加表格菜单，避免只读状态出现误导性操作。
    if (是可编辑表格) {
        添加表格菜单({ protyle, range, element: nodeElement });
    }
    触发插件菜单事件(protyle, nodeElement, range);
};
