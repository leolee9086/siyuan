/**
 * RefDefs 获取函数
 * 从 popover.ts 拆分出来，处理各种来源的 refDefs 获取逻辑
 */

// 用途：发送同步 POST 请求到后端 API；使用范围：所有需要从后端获取引用定义数据的函数；解耦评估：网络请求基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { fetchSyncPost } from "./imports";
// 用途：解析思源协议 URL；使用范围：getRefDefs 函数中处理思源协议链接时解析 ID；解耦评估：纯函数工具，通过参数传递即可，已充分解耦
import { parseSiYuanUriInfo } from "./imports";
// 用途：获取当前 popover 的目标元素；使用范围：本文件所有需要访问触发 popover 的 DOM 元素的场景；解耦评估：可通过参数传递解耦，但作为模块内共享状态，直接导入更合理
import { getPopoverTargetElement } from "./target";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RefDefs 获取函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 从 data-id 属性获取 refDefs
 */
const getRefDefsFromDataId = async (dataId: string, showRef: boolean) => {
    const ids = dataId.split(/\s+/);
    // 卫语句：showRef 情况，对首个 ID 查询引用来源（多 ID 暂只取首个）
    if (showRef) {
        const postResponse = await fetchSyncPost("/api/block/getRefIDs", { id: ids[0] });
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

    // 多 ID：展开为多个 refDef
    const refDefs: IRefDefs[] = ids.map((id) => ({ refID: id }));
    return { refDefs, originalRefBlockIDs: {} };
};

/**
 * 从虚拟块引用获取 refDefs
 */
const getRefDefsFromVirtualBlockRef = async () => {
    const popoverTargetElement = getPopoverTargetElement();
    if (!popoverTargetElement) {
        return { refDefs: [], originalRefBlockIDs: {} };
    }
    const postResponse = await fetchSyncPost("/api/block/getBlockDefIDsByRefText", {
        anchor: popoverTargetElement.textContent,
    });
    return { refDefs: postResponse.data.refDefs, originalRefBlockIDs: {} };
};

/** 将思源链接中的块和数据库定位信息投影为浮窗引用。 */
const getRefDefFromSiYuanURI = (uri: string | null | undefined) => {
    const blockInfo = parseSiYuanUriInfo(uri);
    return {
        refID: blockInfo?.id ?? "",
        avItemID: blockInfo?.avItemID,
        avViewID: blockInfo?.avViewID,
        avGroupID: blockInfo?.avGroupID,
    };
};

/**
 * 从引用数或 PDF 获取 refDefs
 */
const getRefDefsFromRefCountOrPDF = async () => {
    const popoverTargetElement = getPopoverTargetElement();
    if (!popoverTargetElement) {
        return { refDefs: [], originalRefBlockIDs: {} };
    }
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
export const getRefDefs = async (showRef: boolean) => {
    const popoverTargetElement = getPopoverTargetElement();
    if (!popoverTargetElement) {
        return { refDefs: [], originalRefBlockIDs: {} };
    }
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
            refDefs: [getRefDefFromSiYuanURI(popoverTargetElement.getAttribute("data-href"))],
            originalRefBlockIDs: {}
        };
    }

    // database URL 列中的思源协议链接
    if (popoverTargetElement.dataset.type === "url") {
        return {
            refDefs: [getRefDefFromSiYuanURI(popoverTargetElement.dataset.href || popoverTargetElement.textContent.trim())],
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
