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
    let refDefs: IRefDefs[] = [];
    let originalRefBlockIDs: IObject = {};

    if (showRef) {
        const postResponse = await fetchSyncPost("/api/block/getRefIDs", { id: dataId });
        refDefs = postResponse.data.refDefs;
        originalRefBlockIDs = postResponse.data.originalRefBlockIDs;
    } else {
        if (dataId.startsWith("[")) {
            JSON.parse(dataId).forEach((item: string) => {
                refDefs.push({ refID: item });
            });
        } else {
            refDefs = [{ refID: dataId }];
        }
    }

    return { refDefs, originalRefBlockIDs };
};

/**
 * 从虚拟块引用获取 refDefs
 */
const getRefDefsFromVirtualBlockRef = async (): Promise<RefDefsResult> => {
    const popoverTargetElement = getPopoverTargetElement();
    const nodeElement = hasClosestBlock(popoverTargetElement);
    if (nodeElement) {
        const postResponse = await fetchSyncPost("/api/block/getBlockDefIDsByRefText", {
            anchor: popoverTargetElement.textContent,
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
    let refDefs: IRefDefs[] = [];
    let originalRefBlockIDs: IObject = {};
    let targetId: string;
    let url = "/api/block/getRefIDs";

    if (popoverTargetElement.classList.contains("protyle-attr--refcount")) {
        // 编辑器中的引用数
        targetId = popoverTargetElement.parentElement.parentElement.getAttribute("data-node-id");
    } else if (popoverTargetElement.classList.contains("pdf__rect")) {
        const relationIds = popoverTargetElement.getAttribute("data-relations");
        if (relationIds) {
            relationIds.split(",").forEach((item: string) => {
                refDefs.push({ refID: item });
            });
            url = "";
        } else {
            targetId = popoverTargetElement.getAttribute("data-node-id");
            url = "/api/block/getRefIDsByFileAnnotationID";
        }
    } else if (!targetId) {
        // 文件树中的引用数
        targetId = popoverTargetElement.parentElement.getAttribute("data-node-id");
    }

    if (url) {
        const postResponse = await fetchSyncPost(url, { id: targetId });
        refDefs = postResponse.data.refDefs;
        originalRefBlockIDs = postResponse.data.originalRefBlockIDs;
    }

    return { refDefs, originalRefBlockIDs };
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
            refDefs: [{ refID: getIdFromSYProtocol(popoverTargetElement.getAttribute("data-href")) }],
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
