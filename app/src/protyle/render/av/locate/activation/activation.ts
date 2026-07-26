/** 用途：读取统一定位状态；使用范围：排队、本地数据复用和重试；解耦评估：直达状态真实所有者。 */
import {getAVLocateRegistry} from "./imports";
/** 用途：读取已渲染数据；使用范围：本地复用；解耦评估：经本阶段网关直达状态所有者。 */
import {getRenderedAVData} from "./imports";
/** 用途：写入定位请求；使用范围：激活；解耦评估：经本阶段网关直达状态所有者。 */
import {setAVLocateRequest} from "./imports";
/** 用途：清除旧定位高亮；使用范围：新定位激活前；解耦评估：直达呈现生命周期唯一实现。 */
import {clearLocatedHighlight} from "./imports";
/** 用途：完整定位请求；使用范围：公开 API 与本地解析；解耦评估：纯类型直达领域声明。 */
import type {AVLocateActivationContext} from "./imports";
/** 用途：排队请求状态；使用范围：排队清理；解耦评估：经本阶段网关直达纯类型声明。 */
import type {AVQueuedLocateRequest} from "./imports";
/** 用途：排队重试状态；使用范围：token 隔离；解耦评估：经本阶段网关直达纯类型声明。 */
import type {AVQueuedLocateRetryState} from "./imports";
/** 用途：定位请求；使用范围：公开 API 与本地解析；解耦评估：经本阶段网关直达纯类型声明。 */
import type {IAVLocateRequest} from "./imports";

const locateQueueTimeout = 30000;

/** 在一个未分组视图或具体分组中查找目标索引。
 * @显式返回类型原因：固定 IAVRenderTarget 的 status 字面量，避免对象推导拓宽为普通 string。
 */
const findLocalTarget = (data: IAV, request: IAVLocateRequest,
                         view: IAVTable | IAVGallery | IAVKanban): IAVRenderTarget | undefined => {
    const groupID = view === data.view ? "" : view.id;
    const items = "rows" in view ? view.rows : view.cards;
    const localIndex = items?.findIndex(item => item.id === request.itemID) ?? -1;
    if (localIndex < 0) {
        return;
    }
    const offset = data.target?.status === "visible" && (data.target.groupID || "") === groupID ? data.target.offset : 0;
    return {
        status: "visible",
        itemID: request.itemID,
        groupID: groupID || undefined,
        index: offset + localIndex,
        offset,
        pageSize: view.pageSize,
    };
};

/** 在当前已渲染数据中解析目标，视图或条目不匹配时交由根重新请求。 */
const getLocalAVLocateData = (data: IAV | undefined, request: IAVLocateRequest) => {
    if (!data || (request.viewID && request.viewID !== data.viewID)) {
        return;
    }
    const view = data.view;
    let target: IAVRenderTarget | undefined;
    // 分组视图优先检查请求指定分组，再检查其余分组，保持既有容错查找顺序。
    if (view.groups?.length > 0) {
        const groups = request.groupID ? [
            ...view.groups.filter(group => group.id === request.groupID),
            ...view.groups.filter(group => group.id !== request.groupID),
        ] : view.groups;
        for (const group of groups) {
            target = findLocalTarget(data, request, group);
            if (target) {
                break;
            }
        }
        return target ? {...data, target} : undefined;
    }
    target = findLocalTarget(data, request, view);
    return target ? {...data, target} : undefined;
};

/** 删除仍对应指定请求的过期排队项。 */
const expireQueuedLocate = (blockID: string, request: IAVLocateRequest) => {
    const queuedRequests = getAVLocateRegistry().queuedLocateRequests;
    // 只删除仍对应本次请求的项，避免旧 timeout 清除后来的同块请求。
    if (queuedRequests.get(blockID)?.request === request) {
        queuedRequests.delete(blockID);
    }
};

/** 清除当前排队项及其过期 timer，不影响同块后续请求。 */
const clearQueuedLocate = (blockID: string, queued: AVQueuedLocateRequest) => {
    const queuedRequests = getAVLocateRegistry().queuedLocateRequests;
    window.clearTimeout(queued.timer);
    // 身份匹配保证旧激活流程不会删除后续替换请求。
    if (queuedRequests.get(blockID) === queued) {
        queuedRequests.delete(blockID);
    }
};

/** 登记等待文档渲染的定位请求，并替换同一块的旧排队项。 @同步豁免: 生命周期 - 导航必须先登记再打开文档。 */
export const queueAVLocateRequest = (blockID: string, request: IAVLocateRequest) => {
    const queuedRequests = getAVLocateRegistry().queuedLocateRequests;
    const previous = queuedRequests.get(blockID);
    if (previous) {
        window.clearTimeout(previous.timer);
    }
    const locateRequest = {...request, select: true, highlight: true};
    // 排队请求最多保留 30 秒，避免不存在的块长期占用导航状态。
    const timer = window.setTimeout(expireQueuedLocate, locateQueueTimeout, blockID, locateRequest);
    queuedRequests.set(blockID, {request: locateRequest, timer});
};

/** 激活已渲染 AV，保持同步状态切换并在下一微任务启动根渲染。 @同步豁免: 生命周期 - 返回值供当前打开流程立即判断。 */
export const activateAVLocate = (context: AVLocateActivationContext, request?: IAVLocateRequest) => {
    const {renderAV, protyle, blockID} = context;
    const blockElement = protyle?.wysiwyg.element.querySelector(`.av[data-node-id="${blockID}"]`);
    if (!request || !(blockElement instanceof HTMLElement) || blockElement.getAttribute("data-render") !== "true") {
        return false;
    }
    clearLocatedHighlight(blockElement);
    setAVLocateRequest(blockElement, request);
    blockElement.removeAttribute("data-render");
    const localData = getLocalAVLocateData(getRenderedAVData(blockElement), request);
    queueMicrotask(renderAV.bind(undefined, blockElement, protyle, undefined, true, localData));
    return true;
};

/** 在块完成渲染前按 50ms 周期尝试即时定位。 */
const retryAVLocate = (context: AVLocateActivationContext, request: IAVLocateRequest, timeout: number) => {
    // 激活成功后停止当前重试链。
    if (activateAVLocate(context, request)) {
        return;
    }
    // 编辑器仍连接且未到截止时间时继续等待目标 AV 完成渲染。
    if (context.protyle.element.isConnected && performance.now() < timeout) {
        // 50ms 周期平衡文档渲染响应速度与主线程开销。
        window.setTimeout(retryAVLocate, 50, context, request, timeout);
    }
};

/** 在编辑器仍连接期间重试即时定位。 @同步豁免: 生命周期 - 首次尝试必须在当前加载回调内启动。 */
export const activateAVLocateWithRetry = (context: AVLocateActivationContext, request: IAVLocateRequest) => {
    const timeout = performance.now() + locateQueueTimeout;
    retryAVLocate(context, request, timeout);
};

/** 等待 AV 首次渲染并以 token 隔离被替换的排队重试链。 */
const retryQueuedAVLocate = (context: AVLocateActivationContext, retryState: AVQueuedLocateRetryState) => {
    const {queued, timeout, activationToken} = retryState;
    const queuedRequests = getAVLocateRegistry().queuedLocateRequests;
    // 排队项或 token 已变化说明请求被替换，本链立即结束。
    if (queuedRequests.get(context.blockID) !== queued || queued.activationToken !== activationToken) {
        return;
    }
    // 激活成功后原子清理本排队项。
    if (activateAVLocate(context, queued.request)) {
        clearQueuedLocate(context.blockID, queued);
        return;
    }
    // 截止时间内继续按固定周期等待文档渲染。
    if (performance.now() < timeout) {
        // 50ms 与即时定位重试保持一致。
        window.setTimeout(retryQueuedAVLocate, 50, context, retryState);
    }
};

/** 消费排队请求；未渲染完成时以 activation token 隔离旧重试。 @同步豁免: 生命周期 - 同步返回是否已消费。 */
export const activateQueuedAVLocate = (context: AVLocateActivationContext) => {
    const {protyle, blockID} = context;
    const queuedRequests = getAVLocateRegistry().queuedLocateRequests;
    const queued = queuedRequests.get(blockID);
    if (!queued || !protyle) {
        return false;
    }
    // AV 已可用时同步消费排队请求。
    if (activateAVLocate(context, queued.request)) {
        clearQueuedLocate(blockID, queued);
        return true;
    }
    const activationToken = Symbol();
    queued.activationToken = activationToken;
    const timeout = performance.now() + locateQueueTimeout;
    const retryState: AVQueuedLocateRetryState = {queued, timeout, activationToken};
    // 首次延迟避免在当前文档打开回调栈内重复查询未完成 DOM。
    window.setTimeout(retryQueuedAVLocate, 50, context, retryState);
    return false;
};
