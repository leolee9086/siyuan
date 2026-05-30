/**
 * Gutter 块菜单 - 标题子菜单构建模块
 * 从 renderMenu 提取的标题菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中标题块 (NodeHeading) 相关子菜单的构建功能
 * @module protyle/gutter/buildGutterHeadingMenu
 */

import { fetchPost } from "../../util/network/fetch";
import { focusBlock } from "../util/selection";
import { mathRender } from "../render/mathRender";
import { transaction } from "../wysiwyg/transaction";
import { genEmptyElement } from "../../block/util";
import { Constants } from "../../constants";
import { isInAndroid, isInHarmony, writeText } from "../util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getWindowJSAndroid, getWindowJSHarmony } from "../../util/siyuanEnvironments/windowNative.environment";

/**
 * 标题菜单构建上下文
 * @interface IGutterHeadingMenuContext
 */
export interface IGutterHeadingMenuContext {
    /** 目标节点元素 */
    nodeElement: Element;
    /** 节点 ID */
    id: string;
    /** 节点子类型 (h1-h6) */
    subType: string;
    /** Protyle 实例 */
    protyle: IProtyle;
}

/**
 * 标题菜单构建结果
 * @interface IGutterHeadingMenuResult
 */
export interface IGutterHeadingMenuResult {
    /** 标题级别转换子菜单项 */
    标题级别转换: IMenu[];
    /** 其他操作菜单项（复制/剪切/删除标题及下级） */
    其他操作: IMenu[];
}

/**
 * 将内容写入剪贴板（兼容各平台）
 * @param protyle Protyle 实例
 * @param responseData 响应数据
 */
/**
 * 将内容写入剪贴板（兼容各平台）
 * 与上游 writeSiYuanHTMLClipboard 行为对齐，写入 markdown、html 和原始BlockDOM三种格式
 * @param protyle Protyle 实例
 * @param responseData 响应数据（原始 BlockDOM）
 */
const 写入剪贴板 = (protyle: IProtyle, responseData: string): void => {
    const lute = protyle.lute;
    if (!lute) {
        writeText(responseData + Constants.ZWSP);
        return;
    }

    const markdownContent = lute.BlockDOM2StdMd(responseData).trimEnd();
    const htmlContent = responseData + Constants.ZWSP;
    // @siyuan-保留原始BlockDOM数据作为第三个参数，确保剪贴板保留完整的块元数据
    const rawBlockDOM = responseData + Constants.ZWSP;

    if (isInAndroid()) {
        const jsAndroid = getWindowJSAndroid();
        jsAndroid?.writeSiYuanHTMLClipboard(markdownContent, htmlContent, rawBlockDOM);
        return;
    }
    if (isInHarmony()) {
        const jsHarmony = getWindowJSHarmony();
        jsHarmony?.writeSiYuanHTMLClipboard(markdownContent, htmlContent, rawBlockDOM);
        return;
    }
    writeText(htmlContent);
};

/**
 * 处理删除标题及下级后的空文档情况
 * @param protyle Protyle 实例
 * @param doOperations 执行操作列表
 * @param undoOperations 撤销操作列表
 */
const 处理删除后空文档 = (
    protyle: IProtyle,
    doOperations: IOperation[],
    undoOperations: IOperation[]
): void => {
    const wysiwygElement = protyle.wysiwyg?.element;
    if (!wysiwygElement || wysiwygElement.childElementCount !== 0) {
        return;
    }

    const newID = Lute.NewNodeID();
    const emptyElement = genEmptyElement(false, false, newID);
    wysiwygElement.insertAdjacentElement("afterbegin", emptyElement);
    doOperations.push({
        action: "insert",
        data: emptyElement.outerHTML,
        id: newID,
        parentID: protyle.block.parentID
    });
    undoOperations.push({
        action: "delete",
        id: newID,
    });
    focusBlock(emptyElement);
};

/**
 * 根据操作删除 DOM 元素
 * @param wysiwygElement 编辑器容器元素
 * @param operations 操作列表
 */
const 删除相关DOM元素 = (wysiwygElement: Element | undefined, operations: IOperation[]): void => {
    if (!wysiwygElement) {
        return;
    }
    for (const operation of operations) {
        const 节点列表 = wysiwygElement.querySelectorAll(`[data-node-id="${operation.id}"]`);
        for (const itemElement of 节点列表) {
            itemElement.remove();
        }
    }
};

/**
 * 获取标题级别对应的国际化标签
 * @param level 标题级别 (1-6)
 * @returns 标签字符串
 */
const 获取标题级别标签 = (level: number): string => {
    const key = "heading" + level as keyof typeof siyuanI18n;
    const label = siyuanI18n[key];
    if (typeof label === "string") {
        return label;
    }
    return "Heading " + level;
};

/**
 * 生成标题级别转换菜单项
 * @param protyle Protyle 实例
 * @param id 节点 ID
 * @param level 目标标题级别 (1-6)
 * @returns 菜单项配置
 */
const 生成标题级别转换菜单项 = (protyle: IProtyle, id: string, level: number): IMenu => {
    return {
        id: "heading" + level,
        iconHTML: "",
        icon: "iconHeading" + level,
        label: 获取标题级别标签(level),
        click() {
            // @内联回调
            fetchPost("/api/block/getHeadingLevelTransaction", {
                id,
                level
            }, (response) => {
                const wysiwygElement = protyle.wysiwyg?.element;
                if (!wysiwygElement) {
                    return;
                }
                let 首项已处理 = false;
                for (const operation of response.data.doOperations) {
                    // 先更新 outerHTML
                    const 节点列表 = wysiwygElement.querySelectorAll(`[data-node-id="${operation.id}"]`);
                    for (const itemElement of 节点列表) {
                        (itemElement as HTMLElement).outerHTML = operation.data;
                    }
                    // 使用 outer 后元素需要重新查询
                    const 更新后节点列表 = wysiwygElement.querySelectorAll(`[data-node-id="${operation.id}"]`);
                    for (const itemElement of 更新后节点列表) {
                        mathRender(itemElement as HTMLElement);
                    }
                    if (首项已处理) {
                        continue;
                    }
                    首项已处理 = true;
                    const 首个节点 = wysiwygElement.querySelector(`[data-node-id="${operation.id}"]`);
                    if (首个节点) {
                        focusBlock(首个节点, wysiwygElement, true);
                    }
                }
                transaction(protyle, response.data.doOperations, response.data.undoOperations);
            });
        }
    };
};

/**
 * 构建标题级别转换子菜单
 * @param ctx 上下文
 * @returns 标题级别转换菜单项数组
 */
const 构建标题级别转换子菜单 = (ctx: IGutterHeadingMenuContext): IMenu[] => {
    const 子菜单列表: IMenu[] = [];
    const 所有级别 = ["h1", "h2", "h3", "h4", "h5", "h6"];

    for (let 索引 = 0; 索引 < 所有级别.length; 索引++) {
        const 级别 = 所有级别[索引];
        if (ctx.subType !== 级别) {
            子菜单列表.push(生成标题级别转换菜单项(ctx.protyle, ctx.id, 索引 + 1));
        }
    }

    return 子菜单列表;
};

/**
 * 复制标题及其下级块内容
 * @param ctx 上下文
 * @returns 复制标题子级菜单项
 */
const 创建复制标题及下级菜单项 = (ctx: IGutterHeadingMenuContext): IMenu => ({
    id: "copyHeadings1",
    icon: "iconCopy",
    label: `${siyuanI18n.copy} ${siyuanI18n.headings1}`,
    click() {
        // @内联回调
        fetchPost("/api/block/getHeadingChildrenDOM", {
            id: ctx.id,
            removeFoldAttr: ctx.nodeElement.getAttribute("fold") !== "1"
        }, (response) => {
            写入剪贴板(ctx.protyle, response.data);
        });
    }
});

/**
 * 剪切标题及其下级块内容
 * @param ctx 上下文
 * @returns 剪切标题子级菜单项
 */
const 创建剪切标题及下级菜单项 = (ctx: IGutterHeadingMenuContext): IMenu => ({
    id: "cutHeadings1",
    icon: "iconCut",
    label: `${siyuanI18n.cut} ${siyuanI18n.headings1}`,
    click() {
        // @内联回调
        fetchPost("/api/block/getHeadingChildrenDOM", {
            id: ctx.id,
            removeFoldAttr: ctx.nodeElement.getAttribute("fold") !== "1"
        }, (response) => {
            // 先复制到剪贴板
            写入剪贴板(ctx.protyle, response.data);
            // 然后删除
            // @内联回调
            fetchPost("/api/block/getHeadingDeleteTransaction", {
                id: ctx.id,
            }, (deleteResponse) => {
                const wysiwygElement = ctx.protyle.wysiwyg?.element;
                删除相关DOM元素(wysiwygElement, deleteResponse.data.doOperations);
                处理删除后空文档(ctx.protyle, deleteResponse.data.doOperations, deleteResponse.data.undoOperations);
                transaction(ctx.protyle, deleteResponse.data.doOperations, deleteResponse.data.undoOperations);
            });
        });
    }
});

/**
 * 删除标题及其下级块内容
 * @param ctx 上下文
 * @returns 删除标题子级菜单项
 */
const 创建删除标题及下级菜单项 = (ctx: IGutterHeadingMenuContext): IMenu => ({
    id: "deleteHeadings1",
    icon: "iconTrashcan",
    label: `${siyuanI18n.delete} ${siyuanI18n.headings1}`,
    click() {
        // @内联回调
        fetchPost("/api/block/getHeadingDeleteTransaction", {
            id: ctx.id,
        }, (response) => {
            const wysiwygElement = ctx.protyle.wysiwyg?.element;
            删除相关DOM元素(wysiwygElement, response.data.doOperations);
            处理删除后空文档(ctx.protyle, response.data.doOperations, response.data.undoOperations);
            transaction(ctx.protyle, response.data.doOperations, response.data.undoOperations);
        });
    }
});

/**
 * 构建 Gutter 标题子菜单
 * 
 * @param ctx 标题菜单构建上下文
 * @returns 标题子菜单项结果对象
 * 
 * @example
 * ```typescript
 * const headingMenu = buildGutterHeadingMenu({
 *     nodeElement,
 *     id,
 *     subType,
 *     protyle
 * });
 * // 使用 headingMenu.标题级别转换 和 headingMenu.其他操作
 * ```
 */
export const buildGutterHeadingMenu = (ctx: IGutterHeadingMenuContext): IGutterHeadingMenuResult => {
    return {
        标题级别转换: 构建标题级别转换子菜单(ctx),
        其他操作: [
            创建复制标题及下级菜单项(ctx),
            创建剪切标题及下级菜单项(ctx),
            创建删除标题及下级菜单项(ctx)
        ]
    };
};
