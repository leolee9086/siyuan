/**
 * Outline 类的辅助函数
 * 将原本的私有方法提取为模块级函数，提高可测试性
 */

import { fetchPost } from "../../../util/fetch";
import { hasClosestBlock } from "../../../protyle/util/hasClosest";
import { updateHotkeyAfterTip } from "../../../protyle/util/compatibility";
import { Constants } from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanStorage, getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";

import type { Outline } from "./Outline";

/**
 * 生成 Outline 面板的 HTML 结构
 * @param type - Outline 类型: "pin" | "local"
 */
export function 生成面板HTML(type: "pin" | "local"): string {
    const outlineStorage = getSiyuanStorage()[Constants.LOCAL_OUTLINE];
    const keepExpandActive = outlineStorage?.keepCurrentExpand ? " block__icon--active" : "";

    return `<div class="block__icons fn__hidescrollbar">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconAlignCenter"></use></svg>${siyuanI18n.outline}
    </div>
    <span class="fn__flex-1 fn__space"></span>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${siyuanI18n.filterKeywordEnter}" />
    <span data-type="search" class="block__icon ariaLabel" aria-label="${siyuanI18n.filter}">
        <svg><use xlink:href='#iconFilter'></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="keepCurrentExpand" class="block__icon ariaLabel${keepExpandActive}" aria-label="${siyuanI18n.outlineKeepCurrentExpand}">
        <svg><use xlink:href="#iconFocus"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="expandLevel" class="block__icon ariaLabel" aria-label="${siyuanI18n.expandLevel}">
        <svg><use xlink:href="#iconList"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="expand" class="block__icon ariaLabel" aria-label="${siyuanI18n.expandAll}${updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.expand.custom)}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon ariaLabel" aria-label="${siyuanI18n.foldAll}${updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.collapse.custom)}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="${type === "local" ? "fn__none " : ""}fn__space"></span>
    <span data-type="min" class="${type === "local" ? "fn__none " : ""}block__icon ariaLabel" aria-label="${siyuanI18n.min}${updateHotkeyAfterTip(getSiyuanConfig().keymap.general.closeTab.custom)}">
        <svg><use xlink:href='#iconMin'></use></svg>
    </span>
</div>
<div class="b3-list-item fn__none"></div>
<div class="fn__flex-1" style="padding: 3px 0 8px"></div>`;
}

// 英文别名导出
export { 生成面板HTML as genPanelHTML };

/**
 * 检查操作是否需要触发大纲重载
 * @param item - 操作项
 * @param outlineElement - Outline 的 DOM 元素
 * @returns 是否需要重载
 */
function 检查操作是否需要重载(item: IOperation, outlineElement: Element): boolean {
    if (item.action === "update") {
        const hasExistingItem = outlineElement.querySelector(`.b3-list-item[data-node-id="${item.id}"]`);
        const isHeading = item.data.indexOf('data-type="NodeHeading"') > -1;
        return hasExistingItem !== null || isHeading;
    }
    if (item.action === "insert") {
        return item.data.indexOf('data-type="NodeHeading"') > -1;
    }
    return item.action === "delete" || item.action === "move";
}

/**
 * 处理事务数据，决定是否需要重新加载大纲
 * @param outline - Outline 实例
 * @param data - WebSocket 数据
 */
export function 处理事务(outline: Outline, data: IWebSocketData): void {
    if (data.data.rootID !== outline.blockId) {
        return;
    }

    let needReload = false;
    const ops = data.data.sources[0];

    ops.doOperations.find((item: IOperation) => {
        if (检查操作是否需要重载(item, outline.element)) {
            needReload = true;
            return true;
        }
    });

    if (!needReload && ops.undoOperations) {
        ops.undoOperations.find((item: IOperation) => {
            if (item.action === "update" && item.data?.indexOf('data-type="NodeHeading"') > -1) {
                needReload = true;
                return true;
            }
        });
    }

    if (needReload) {
        // @内联回调
        fetchPost("/api/outline/getDocOutline", { id: outline.blockId, preview: outline.isPreview }, response => {
            处理大纲响应(outline, data, response);
        });
    }
}

/**
 * 处理大纲请求的响应
 */
function 处理大纲响应(outline: Outline, data: IWebSocketData, response: IWebSocketData): void {
    if (data.data.rootID !== outline.blockId) {
        return;
    }
    outline.update(response);
    outline.updateDocTitle(undefined, response.data?.length || 0);
    同步当前选中的标题(outline);
}

/**
 * 根据当前光标位置同步选中的标题
 */
function 同步当前选中的标题(outline: Outline): void {
    const selection = getSelection();
    if (!selection || selection.rangeCount <= 0) {
        return;
    }
    const blockElement = hasClosestBlock(selection.getRangeAt(0).startContainer);
    if (!blockElement || blockElement.getAttribute("data-type") !== "NodeHeading") {
        return;
    }
    outline.setCurrent(blockElement);
}

// 英文别名导出
export { 处理事务 as handleTransaction };

/**
 * 创建 Model 的 callback 回调函数
 * 用于检查 local 类型的 Outline 对应的文档是否还存在
 */
export function 创建回调函数(): () => void {
    // 这里使用普通函数，保持 this 绑定
    return function (this: Outline) {
        if (this.type !== "local") {
            return;
        }
        fetchPost("/api/block/checkBlockExist", { id: this.blockId }, existResponse => {
            if (!existResponse.data) {
                this.parent.parent.removeTab(this.parent.id);
            }
        });
    };
}

/**
 * 创建 Model 的 msgCallback 消息回调函数
 * 处理来自 WebSocket 的各种消息
 */
export function 创建消息回调函数(): (data: IWebSocketData) => void {
    // 消息类型到处理函数的映射
    const 消息处理器: Record<string, (outline: Outline, data: IWebSocketData) => void> = {
        savedoc: (outline, data) => 处理事务(outline, data),
        rename: (outline, data) => {
            if (outline.type === "local" && outline.blockId === data.data.id) {
                outline.parent.updateTitle(data.data.title);
                return;
            }
            outline.updateDocTitle({ title: data.data.title, icon: Constants.ZWSP }, -1);
        },
        unmount: (outline) => {
            if (outline.type !== "local") {
                return;
            }
            fetchPost("/api/block/checkBlockExist", { id: outline.blockId }, existResponse => {
                if (!existResponse.data) {
                    outline.parent.parent.removeTab(outline.parent.id);
                }
            });
        },
        removeDoc: (outline, data) => {
            if (data.data.ids.includes(outline.blockId) && outline.type === "local") {
                outline.parent.parent.removeTab(outline.parent.id);
            }
        },
    };

    return function (this: Outline, data: IWebSocketData) {
        if (!data?.cmd) {
            return;
        }
        const handler = 消息处理器[data.cmd];
        if (handler) {
            handler(this, data);
        }
    };
}

// 英文别名导出
export { 创建回调函数 as createCallback };
export { 创建消息回调函数 as createMsgCallback };
