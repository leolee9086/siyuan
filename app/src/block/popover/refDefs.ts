/**
 * RefDefs 获取函数
 * 从 popover.ts 拆分出来，处理各种来源的 refDefs 获取逻辑
 */

import { hasClosestBlock } from "../../protyle/util/hasClosest";
import { fetchSyncPost } from "../../util/fetch";
import { getIdFromSYProtocol } from "../../util/pathName";
import { getPopoverTargetElement } from "./target";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 类型定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RefDefsResult {
    refDefs: IRefDefs[];
    originalRefBlockIDs: IObject;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RefDefs 获取函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 从 data-id 属性获取 refDefs
 */
const getRefDefsFromDataId = async (dataId: string, showRef: boolean): Promise<RefDefsResult> => {
    // 卫语句：showRef 情况直接返回
    if (showRef) {
        const postResponse = await fetchSyncPost("/api/block/getRefIDs", { id: dataId });
        return {
            refDefs: postResponse.data.refDefs,
            originalRefBlockIDs: postResponse.data.originalRefBlockIDs
        };
    }

    // 卫语句：dataId 是数组格式
    if (dataId.startsWith("[")) {
        const refDefs: IRefDefs[] = JSON.parse(dataId).map((item: string) => {
            return { refID: item };
        });
        return { refDefs, originalRefBlockIDs: {} };
    }

    // 默认：单个 ID
    return { refDefs: [{ refID: dataId }], originalRefBlockIDs: {} };
};

/**
 * 从虚拟块引用获取 refDefs
 */
const getRefDefsFromVirtualBlockRef = async (): Promise<RefDefsResult> => {
    const popoverTargetElement = getPopoverTargetElement();
    const nodeElement = hasClosestBlock(popoverTargetElement);
    if (nodeElement) {
        const postResponse = await fetchSyncPost("/api/block/getBlockDefIDsByRefText", {
            anchor: popoverTargetElement?.textContent,
            excludeIDs: [nodeElement.getAttribute("data-node-id")]
        });
        return { refDefs: postResponse.data.refDefs, originalRefBlockIDs: {} };
    }
    return { refDefs: [], originalRefBlockIDs: {} };
};

/**
 * 从引用数或 PDF 获取 refDefs
 */
const getRefDefsFromRefCountOrPDF = async (): Promise<RefDefsResult> => {
    const popoverTargetElement = getPopoverTargetElement();
    const refDefs: IRefDefs[] = [];
    const originalRefBlockIDs: IObject = {};

    // 卫语句1a：编辑器中的引用数 - 无法获取父节点 ID
    const isRefCount = popoverTargetElement.classList.contains("protyle-attr--refcount");
    const refCountTargetId = popoverTargetElement.parentElement?.parentElement?.getAttribute("data-node-id");
    if (isRefCount && !refCountTargetId) {
        return { refDefs: [], originalRefBlockIDs: {} };
    }

    // 卫语句1b：编辑器中的引用数 - 正常获取
    if (isRefCount && refCountTargetId) {
        const postResponse = await fetchSyncPost("/api/block/getRefIDs", { id: refCountTargetId });
        return { refDefs: postResponse.data.refDefs, originalRefBlockIDs: postResponse.data.originalRefBlockIDs };
    }

    const isPdfRect = popoverTargetElement.classList.contains("pdf__rect");
    const relationIds = isPdfRect ? popoverTargetElement.getAttribute("data-relations") : null;

    // 卫语句2：PDF 标注 - 有 relationIds 的情况
    if (isPdfRect && relationIds) {
        for (const item of relationIds.split(",")) {
            refDefs.push({ refID: item });
        }
        return { refDefs, originalRefBlockIDs };
    }

    // 卫语句3：PDF 标注 - 无 relationIds，走 FileAnnotationID 接口
    if (isPdfRect) {
        const targetId = popoverTargetElement.getAttribute("data-node-id");
        const postResponse = await fetchSyncPost("/api/block/getRefIDsByFileAnnotationID", { id: targetId });
        return { refDefs: postResponse.data.refDefs, originalRefBlockIDs: postResponse.data.originalRefBlockIDs };
    }

    // 默认：文件树中的引用数
    const targetId = popoverTargetElement.parentElement?.getAttribute("data-node-id");
    if (!targetId) {
        return { refDefs: [], originalRefBlockIDs: {} };
    }
    const postResponse = await fetchSyncPost("/api/block/getRefIDs", { id: targetId });
    return { refDefs: postResponse.data.refDefs, originalRefBlockIDs: postResponse.data.originalRefBlockIDs };
};

/**
 * 获取所有 refDefs
 */
export const getRefDefs = async (showRef: boolean): Promise<RefDefsResult> => {
    const popoverTargetElement = getPopoverTargetElement();
    const dataId = popoverTargetElement.getAttribute("data-id");

    // 从 data-id 获取
    if (dataId) {
        return getRefDefsFromDataId(dataId, showRef);
    }

    // 虚拟块引用
    if (popoverTargetElement.getAttribute("data-type")?.includes("virtual-block-ref")) {
        return getRefDefsFromVirtualBlockRef();
    }

    // 思源协议链接
    if (popoverTargetElement.getAttribute("data-type")?.split(" ").includes("a")) {
        return {
            refDefs: [{ refID: getIdFromSYProtocol(popoverTargetElement.getAttribute("data-href") ?? "") }],
            originalRefBlockIDs: {}
        };
    }

    // database URL 列中的思源协议链接
    if (popoverTargetElement.dataset.type === "url") {
        return {
            refDefs: [{ refID: getIdFromSYProtocol(popoverTargetElement.textContent.trim()) }],
            originalRefBlockIDs: {}
        };
    }

    // 镜像数据库
    if (popoverTargetElement.dataset.popoverUrl) {
        const postResponse = await fetchSyncPost(popoverTargetElement.dataset.popoverUrl, { avID: popoverTargetElement.dataset.avId });
        return { refDefs: postResponse.data.refDefs, originalRefBlockIDs: {} };
    }

    // 引用数或 PDF
    return getRefDefsFromRefCountOrPDF();
};
