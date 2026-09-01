/**
 * 用途：引入 action 子目录网关依赖。
 * 使用范围：仅在标题同步模块中使用，负责事务提交、提示文案和时间戳生成。
 * 解耦评估：标题同步横跨 DOM、事务和 i18n，集中通过 imports.ts 引入能把跨层依赖保持在单点。
 */
import {Constants} from "./name/imports";
/**
 * 用途：生成 `updated` 字段需要的时间戳字符串。
 * 使用范围：仅在标题确实发生变化并准备提交事务时使用，不参与其它展示逻辑。
 * 解耦评估：时间格式约束和事务协议耦合，改成参数传入只会把实现细节外泄，继续通过 imports.ts 统一转发更合适。
 */
import {dayjs} from "./name/imports";
/**
 * 用途：在标题超长时向用户反馈校验失败原因。
 * 使用范围：仅在标题长度超过 `Constants.SIZE_TITLE` 的拦截分支使用。
 * 解耦评估：提示能力属于 UI 基础设施，不适合让调用方预先注入回调，维持模块内直接调用更符合当前交互链路。
 */
import {showMessage} from "./name/imports";
/**
 * 用途：读取标题长度超限时对应的内核国际化文案。
 * 使用范围：仅在 updateAVName 的超长提示分支使用，不扩散到其它标题同步流程。
 * 解耦评估：该文案 key 与现有内核消息表绑定，若强行在调用方上传文案只会增加重复配置，因此保留通过 imports.ts 单点接入。
 */
import {siyuanI18n} from "./name/imports";
/**
 * 用途：把标题修改和块更新时间刷新合并为同一组 do/undo 事务。
 * 使用范围：仅在用户完成标题编辑且文本发生变化后调用。
 * 解耦评估：事务是 action 模块的核心副作用边界，不适合继续拆成事件回调，否则会削弱这里对 do/undo 一致性的控制。
 */
import {submitAVNameTransaction} from "./name/imports";
/**
 * 用途：收窄标题节点和同页其它实例标题节点的 DOM 类型。
 * 使用范围：用于当前块标题读取，以及同页同 AV 标题同步时的目标节点校验。
 * 解耦评估：DOM 收窄属于通用基础能力，继续复用共享 guard 比在本文件重复实现更能保持边界清晰。
 */
import {isHTMLElement} from "./name/imports";

/**
 * 清理标题节点中的占位换行。
 *
 * 意图：属性视图标题在空内容场景下会残留 `<br>`，这会干扰真实文本比较。
 * 调用时机：在 updateAVName 开始计算新标题之前调用。
 * 问题/改进：如果标题未来切换为更结构化的富文本模型，这里应迁移到专门的标题序列化层。
 *
 * @param {HTMLElement} nameElement - 当前属性视图标题元素
 */
const cleanupEmptyTitleBreaks = (nameElement: HTMLElement) => {
    if (nameElement.textContent !== "") {
        return;
    }
    for (const breakElement of nameElement.querySelectorAll("br")) {
        breakElement.remove();
    }
};

/**
 * 同步同一页中其它属性视图实例的标题文本。
 *
 * 意图：当前页可能同时渲染同一个 AV 的多个实例，标题变更后需要避免只更新当前块导致视觉不一致。
 * 调用时机：主标题事务提交并更新当前块 DOM 后调用。
 * 问题/改进：这里只同步当前页面 DOM，不负责跨页或后台实例，后者仍由事务刷新承担。
 *
 * @param {IProtyle} protyle - 当前编辑器实例
 * @param {Element} currentBlockElement - 当前正在编辑的属性视图根块
 * @param {string} avId - 属性视图 ID
 * @param {string} newTitle - 新的标题文本
 */
const syncSamePageAttrViewTitles = (options: {
    protyle: IProtyle;
    currentBlockElement: Element;
    avId: string;
    newTitle: string;
}) => {
    if (!options.protyle.wysiwyg?.element) {
        return;
    }
    const relatedBlocks = options.protyle.wysiwyg.element.querySelectorAll(`.av[data-av-id="${options.avId}"]`);
    for (const relatedBlock of relatedBlocks) {
        if (relatedBlock === options.currentBlockElement) {
            continue;
        }
        const titleCandidate = relatedBlock.querySelector(".av__title");
        if (!isHTMLElement(titleCandidate)) {
            continue;
        }
        titleCandidate.textContent = options.newTitle;
        titleCandidate.dataset.title = options.newTitle;
    }
};

/**
 * 根据标题输入结果更新属性视图名称。
 *
 * 意图：把标题编辑产生的 DOM 文本差异同步为属性视图事务，并保持当前页多个实例的标题一致。
 * 调用时机：在属性视图标题区域发生输入、剪切、插入 HTML 等会改写标题文本的流程中调用。
 * 问题/改进：该函数依然依赖 DOM attribute 保存旧值，未来如统一到状态模型可进一步收缩 DOM 读写。
 *
 * @param {IProtyle} protyle - 当前编辑器实例
 * @param {Element} blockElement - 当前属性视图根块
 * @returns {boolean | void} 超长时返回 false，其余情况下无返回值
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const updateAVName = (protyle: IProtyle, blockElement: Element) => {
    const avId = blockElement.getAttribute("data-av-id");
    const blockId = blockElement.getAttribute("data-node-id");
    const titleCandidate = blockElement.querySelector(".av__title");
    if (!avId || !blockId || !isHTMLElement(titleCandidate)) {
        return;
    }

    cleanupEmptyTitleBreaks(titleCandidate);

    const nextTitle = titleCandidate.textContent.trim();
    const previousTitle = titleCandidate.dataset.title?.trim() ?? "";
    if (nextTitle === previousTitle) {
        return;
    }
    // 标题长度必须和全局标题上限保持一致，超限时直接阻断事务，避免把非法值写进 AV 名称。
    if (nextTitle.length > Constants.SIZE_TITLE) {
        const kernelMessages = siyuanI18n["_kernel"];
        const titleLimitMessage = kernelMessages["106"];
        showMessage(titleLimitMessage);
        return false;
    }

    const updated = dayjs().format("YYYYMMDDHHmmss");
    submitAVNameTransaction({
        protyle,
        doOperations: [{
            action: "setAttrViewName",
            id: avId,
            data: nextTitle,
        }, {
            action: "doUpdateUpdated",
            id: blockId,
            data: updated,
        }],
        undoOperations: [{
            action: "setAttrViewName",
            id: avId,
            data: titleCandidate.dataset.title,
        }, {
            action: "doUpdateUpdated",
            id: blockId,
            data: blockElement.getAttribute("updated"),
        }],
        callback: () => {
            // 仅当顶部属性面板正在展示这个数据库时，事务落盘后才刷新其字段状态。
            if (protyle.databaseAttributePanel?.hasDatabase(avId)) {
                protyle.databaseAttributePanel.refresh();
            }
        },
    });

    blockElement.setAttribute("updated", updated);
    titleCandidate.dataset.title = nextTitle;
    syncSamePageAttrViewTitles({
        protyle,
        currentBlockElement: blockElement,
        avId,
        newTitle: nextTitle,
    });
};
