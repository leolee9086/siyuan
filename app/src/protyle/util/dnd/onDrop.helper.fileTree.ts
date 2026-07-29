/**
 * 文件树拖拽操作辅助模块
 *
 * 作用：处理文件树节点拖拽到编辑器的所有操作
 * 意图：从 onDrop 主函数中提取文件树拖拽逻辑，降低主函数复杂度
 * 调用时机：当 dataTransfer 包含 SIYUAN_DROP_FILE 类型时
 */
import { Constants } from "../../../constants";
import { hasClosestBlock } from "../hasClosest";
import { fetchPost, fetchSyncPost } from "../../../util/network/fetch";
import { insertHTML } from "../insertHTML";
import { onGet } from "../onGet";
import { updateProtylePanel } from "../../runtime/layout.port";
import { isMobile } from "../../../platform";
import { getDynamicLoadBlocks } from "./onDrop.environment";
import { focusAtDropPoint } from "./onDrop.helper.gutter";
import {
    resolveAvItemPreviousId,
    executeAvInsert,
} from "./onDrop.helper.avDrop";
import {withEncryptedNotebook} from "../../../util/file/notebook/store";

/**
 * 文件树拖拽到非 AV 区域：插入引用链接
 *
 * 作用：将文件树节点作为块引用插入到落点位置，多个节点时生成列表
 * 意图：文件树拖拽的默认行为是创建引用，与 gutter alt 拖拽类似但支持列表格式
 * 调用时机：文件树拖拽且非 altKey、目标不是 AV 元素时
 *
 * @param protyle 编辑器实例
 * @param ids 文件树节点 ID 列表
 * @param event 拖拽事件
 * @returns 是否成功插入（false 表示落点在嵌入块内，应中止整个 onDrop）
 */
export const insertFileTreeAsRef = async (
    protyle: IProtyle,
    ids: string[],
    event: DragEvent & { target: HTMLElement },
): Promise<boolean> => {
    // lute 未初始化时无法生成 DOM
    if (!protyle.lute) {
        return true;
    }
    const focusResult = await focusAtDropPoint(protyle, event);
    // 落点在嵌入块内，中止操作
    if (focusResult === "embed") {
        return false;
    }
    let html = "";
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i] ?? "";
        // 多个节点时生成无序列表格式
        if (ids.length > 1) {
            html += "- ";
        }
        const response = await fetchSyncPost("/api/block/getRefText", { id });
        html += `((${id} '${response.data}'))`;
        // 多个节点间用换行分隔，最后一个不加
        if (ids.length > 1 && i !== ids.length - 1) {
            html += "\n";
        }
    }
    insertHTML(protyle.lute.Md2BlockDOM(html), protyle);
    return true;
};

/**
 * 文件树拖拽到 AV 行/画廊区域：插入为 AV 块
 *
 * 作用：将文件树节点作为 AV 行插入到属性视图中
 * 意图：复用 avDrop 模块的 executeAvInsert，构建 srcs 后委托执行
 * 调用时机：文件树拖拽到 av__row / av__gallery-item / av__gallery-add 时
 *
 * @param protyle 编辑器实例
 * @param ids 文件树节点 ID 列表
 * @param targetElement 拖拽目标元素
 * @param targetClass 目标元素的 CSS 类名列表
 */
export const insertFileTreeToAv = async (
    protyle: IProtyle,
    ids: string[],
    targetElement: Element,
    targetClass: string[],
): Promise<void> => {
    const blockElement = hasClosestBlock(targetElement);
    if (!blockElement) {
        return;
    }
    const previousID = resolveAvItemPreviousId(targetElement, targetClass);
    const srcs: IOperationSrcs[] = [];
    for (const id of ids) {
        srcs.push({
            itemID: Lute.NewNodeID(),
            id: id ?? "",
            isDetached: false,
        });
    }
    // 判断动画类型：gallery-item/gallery-add 用 gallery，其余用 row
    const isGallery = targetElement.classList.contains("av__gallery-item")
        || targetElement.classList.contains("av__gallery-add");
    await executeAvInsert(
        protyle, blockElement, targetElement, previousID,
        ids, srcs, isGallery ? "gallery" : "row",
    );
};

/**
 * 文件树拖拽到普通块：将文档转为标题块
 *
 * 作用：调用 doc2Heading API 将文件树文档转为目标块的标题子块
 * 意图：拖拽到下方时逆序插入（after=true），拖拽到上方时正序插入（after=false）
 * 调用时机：文件树拖拽到非 AV 的普通块且有 dragover 标记时
 *
 * @param ids 文件树节点 ID 列表
 * @param targetElement 拖拽目标元素
 * @param isBottom 是否拖拽到目标下方
 */
export const convertDocToHeading = async (
    ids: string[],
    targetElement: Element,
    isBottom: boolean,
): Promise<void> => {
    const targetID = targetElement.getAttribute("data-node-id") ?? "";
    // 拖拽到下方时逆序处理，确保最终顺序正确
    if (isBottom) {
        for (let i = ids.length - 1; i > -1; i--) {
            const srcID = ids[i] ?? "";
            // 跳过空 ID
            if (!srcID) {
                continue;
            }
            await fetchSyncPost("/api/filetree/doc2Heading", {
                srcID, after: true, targetID,
            });
        }
        return;
    }
    // 拖拽到上方时正序处理
    for (const rawId of ids) {
        const srcID = rawId ?? "";
        // 跳过空 ID
        if (!srcID) {
            continue;
        }
        await fetchSyncPost("/api/filetree/doc2Heading", {
            srcID, after: false, targetID,
        });
    }
};

/**
 * 恢复编辑区滚动位置
 *
 * 作用：将编辑区和 scroll 控制器恢复到指定滚动位置
 * 意图：doc2Heading 后编辑区会跳转到开头，需延迟恢复
 * 调用时机：handleDocReloaded 内通过 setTimeout 延迟调用
 *
 * @param protyle 编辑器实例
 * @param scrollTop 目标滚动位置
 */
const restoreScrollPosition = (protyle: IProtyle, scrollTop: number): void => {
    // contentElement 可能在文档切换后被销毁
    if (protyle.contentElement) {
        protyle.contentElement.scrollTop = scrollTop;
    }
    // scroll 控制器可能未初始化
    if (protyle.scroll) {
        protyle.scroll.lastScrollTop = scrollTop - 1;
    }
};

/**
 * fetchPost 回调：重载文档内容并恢复滚动位置
 *
 * 作用：接收 getDoc 响应后更新编辑器内容和大纲面板
 * 意图：doc2Heading 会改变文档结构，需要完整重载以保持一致性
 * 调用时机：reloadDocAfterConvert 中 fetchPost 的回调
 *
 * @param protyle 编辑器实例
 * @param scrollTop 操作前的滚动位置
 * @param getResponse getDoc API 响应
 */
const handleDocReloaded = (
    protyle: IProtyle,
    scrollTop: number,
    getResponse: IWebSocketData,
): void => {
    onGet({ data: getResponse, protyle });
    // 文档标题互转后，需更新大纲（移动端无大纲面板）
    if (!isMobile) {
        updateProtylePanel(protyle, {
            focus: false,
            pushBackStack: false,
            reload: true,
            resize: false,
        });
    }
    // 文档标题互转后，编辑区会跳转到开头，需恢复滚动位置
    // https://github.com/siyuan-note/siyuan/issues/2939
    setTimeout(() => restoreScrollPosition(protyle, scrollTop), Constants.TIMEOUT_LOAD);
};

/**
 * doc2Heading 后重载文档并恢复滚动位置
 *
 * 作用：重新获取文档内容、更新大纲面板、恢复编辑区滚动位置
 * 意图：doc2Heading 会改变文档结构，需要完整重载以保持一致性
 * 调用时机：convertDocToHeading 完成后
 *
 * @param protyle 编辑器实例
 * @param scrollTop 操作前的滚动位置
 */
export const reloadDocAfterConvert = async (
    protyle: IProtyle,
    scrollTop: number,
): Promise<void> => {
    const blockId = protyle.block?.id ?? "";
    const dynamicLoadBlocks = getDynamicLoadBlocks();
    const getDocParams = withEncryptedNotebook(protyle.notebookId, {
        id: blockId,
        size: dynamicLoadBlocks,
    });
    fetchPost("/api/filetree/getDoc", getDocParams,
        (getResponse) => handleDocReloaded(protyle, scrollTop, getResponse));
};
