/**
 * Outline 类的辅助函数
 * 将原本的私有方法提取为模块级函数，提高可测试性
 */

import { fetchPost } from "../../../util/network/fetch";
import { hasClosestBlock } from "../../../protyle/util/hasClosest";
import { updateHotkeyAfterTip } from "../../../protyle/util/compatibility";
import { Constants } from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanStorage, getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowSelection } from "../../../util/siyuanEnvironments/windowStandard.environment";

import type { Outline } from "./Outline";

/**
 * 生成 Outline 面板的 HTML 结构
 * @param type - Outline 类型: "pin" | "local"
 * @同步豁免: UI构建
 */
export function 生成面板HTML(type: "pin" | "local"): string {
    const outlineStorage = getSiyuanStorage()[Constants.LOCAL_OUTLINE];
    const keepExpandActive = outlineStorage?.keepCurrentExpand ? " block__icon--active" : "";

    return `<div class="block__icons fn__hidescrollbar">
    <div class="block__logo">
        ${siyuanI18n.outline}
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
        <svg><use xlink:href="#iconExpandLevel"></use></svg>
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



/**
 * 检查操作是否需要触发大纲重载
 * @param item - 操作项
 * @param outlineElement - Outline 的 DOM 元素
 * @returns 是否需要重载
 */
function 检查操作是否需要重载(item: IOperation, outlineElement: Element): boolean {
    // 意图：处理更新操作。若被更新的块已在大纲中显示（如修改了现有标题的内容），或被更新的块变成了标题（如将普通段落设为标题），则需重载大纲以反映变更。
    if (item.action === "update") {
        const hasExistingItem = outlineElement.querySelector(`.b3-list-item[data-node-id="${item.id}"]`);
        const isHeading = item.data.includes('data-type="NodeHeading"');
        return hasExistingItem !== null || isHeading;
    }
    // 意图：处理插入操作。若插入的新块是标题，则需重载大纲以将其显示出来。
    if (item.action === "insert") {
        return item.data.includes('data-type="NodeHeading"');
    }
    return item.action === "delete" || item.action === "move";
}

/**
 * 处理事务数据，决定是否需要重新加载大纲
 * @param outline - Outline 实例
 * @param data - WebSocket 数据
 * @同步豁免: 遗留代码
 */
export function 处理事务(outline: Outline, data: IWebSocketData): void {
    // 意图：若是其他文档的事务消息，则直接忽略，仅处理当前大纲对应文档的事务。
    if (data.data.rootID !== outline.blockId) {
        return;
    }

    let needReload = false;
    const ops = data.data.sources[0];

    // 检查普通操作是否有涉及大纲结构的变更（如移动、标题更新）
    if (ops.doOperations.some((item: IOperation) => 检查操作是否需要重载(item, outline.element))) {
        needReload = true;
    }

    // 检查撤销操作中是否有涉及标题的更新，因为撤销大纲变动也会影响结构
    if (!needReload && ops.undoOperations && ops.undoOperations.some((item: IOperation) => item.action === "update" && item.data?.includes('data-type="NodeHeading"'))) {
        needReload = true;
    }

    if (needReload) {
        fetchPost("/api/outline/getDocOutline", { id: outline.blockId, preview: outline.isPreview }, 创建获取大纲回调(outline, data));
    }
}

/**
 * 作用：创建处理 doc outline 请求及其响应的回调
 * 意图：封装对大纲数据的响应处理，通过闭包捕获保持上下文 (outline, data)
 * 调用时机：在处理 save doc 事务且检测到需要 reload 时，作为 fetchPost 的回调
 * @param outline Outline 实例
 * @param data 原始 WebSocket 数据
 * @returns 接收 response 的回调函数
 */
function 创建获取大纲回调(outline: Outline, data: IWebSocketData) {
    return (response: IWebSocketData) => {
        处理大纲响应(outline, data, response);
    };
}

/**
 * 作用：处理 doc outline 请求的响应数据
 * 意图：更新大纲视图数据、文档标题，并同步当前选中项
 * 调用时机：fetchPost 请求成功返回后
 * @param outline - Outline 实例
 * @param data - 原始的 WebSocket 触发数据
 * @param response - 接口返回的大纲数据
 */
function 处理大纲响应(outline: Outline, data: IWebSocketData, response: IWebSocketData): void {
    // 意图：校验响应数据是否属于当前大纲对应的文档。
    if (data.data.rootID !== outline.blockId) {
        return;
    }
    outline.update(response);
    outline.updateDocTitle(undefined, response.data?.length || 0);
    同步当前选中的标题(outline);
}

/**
 * 作用：高亮当前光标所在的大纲标题
 * 意图：当用户在编辑器中移动光标时，大纲应自动定位到对应标题
 * 调用时机：刷新大纲后自动调用
 * @param outline - Outline 实例
 */
function 同步当前选中的标题(outline: Outline): void {
    const selection = getWindowSelection();
    // 意图：确保当前有选区，否则无法同步。
    if (!selection || selection.rangeCount <= 0) {
        return;
    }
    const blockElement = hasClosestBlock(selection.getRangeAt(0).startContainer);
    // 意图：仅当光标位于标题块内时才同步大纲高亮。
    if (!blockElement || blockElement.getAttribute("data-type") !== "NodeHeading") {
        return;
    }
    outline.setCurrent(blockElement);
}



/**
 * 作用：验证本地大纲对应的文档是否存在
 * 意图：如果文档已被物理删除（由于外部操作等），则自动关闭大纲 Tab
 * 调用时机：收到相关消息（如 unmount）时调用
 * @param outline - Outline 实例
 * @同步豁免: 生命周期
 */
export function 检查本地文档及其Tab存在的逻辑(outline: Outline): void {
    // 意图：仅Local类型的大纲需要检查文档存在性，Pin类型的大纲常驻不需自动关闭。
    if (outline.type !== "local") {
        return;
    }
    fetchPost("/api/block/checkBlockExist", { id: outline.blockId }, existResponse => {
        // 意图：如果后端返回文档不存在，则移除对应的大纲Tab。
        if (!existResponse.data) {
            outline.parent.parent.removeTab(outline.parent.id);
        }
    });
}

const 消息处理器: Record<string, (outline: Outline, data: IWebSocketData) => void> = {
    savedoc: 处理事务,
    /**
     * 作用：处理 rename 消息
     * 意图：在文档重命名时更新大纲或 Tab 的标题
     * 调用时机：收到 rename 消息时
     */
    rename: (outline, data) => {
        // 意图：若是当前Local大纲对应的文档重命名，则直接更新Tab标题。
        if (outline.type === "local" && outline.blockId === data.data.id) {
            outline.parent.updateTitle(data.data.title);
            return;
        }
        outline.updateDocTitle({ title: data.data.title, icon: Constants.ZWSP }, -1);
    },
    /**
     * 作用：处理 unmount 消息
     * 意图：在某些卸载场景下再次确认文档是否存在，不存在则关闭 Tab
     * 调用时机：收到 unmount 消息时
     */
    unmount: (outline) => {
        检查本地文档及其Tab存在的逻辑(outline);
    },
    /**
     * 作用：处理 removeDoc 消息
     * 意图：当文档被删除时，关闭关联的本地大纲 Tab
     * 调用时机：收到 removeDoc 消息时
     */
    removeDoc: (outline, data) => {
        // 意图：判断当前被删除的文档ID列表中是否包含当前大纲的ID，且当前大纲为Local Tab类型
        // 场景：文档被删除后，清理对应的悬空大纲Tab
        if (data.data.ids.includes(outline.blockId) && outline.type === "local") {
            outline.parent.parent.removeTab(outline.parent.id);
        }
    },
};

/**
 * 处理来自 WebSocket 的各种消息
 * @同步豁免: 生命周期
 */
export function 分发消息回调逻辑(outline: Outline, data: IWebSocketData): void {
    // 意图：防御性校验，确保消息包含命令指令。
    if (!data?.cmd) {
        return;
    }
    const handler = 消息处理器[data.cmd];
    if (handler) {
        handler(outline, data);
    }
}


