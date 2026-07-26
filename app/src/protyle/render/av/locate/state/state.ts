/** 用途：定位注册表键；使用范围：状态存取；解耦评估：经本阶段网关直达全局 Symbol。 */
import {AV_LOCATE_REGISTRY} from "./imports";
/** 用途：读取统一状态；使用范围：状态查询和惰性初始化；解耦评估：经本阶段网关直达唯一实现。 */
import {getSForgeState} from "./imports";
/** 用途：写入统一状态；使用范围：初始化和重置；解耦评估：经本阶段网关直达唯一实现。 */
import {setSForgeState} from "./imports";
/** 用途：读取当前 AV 视图属性；使用范围：定位请求参数；解耦评估：经本阶段网关直达常量所有者。 */
import {Constants} from "./imports";
/** 用途：完整定位请求；使用范围：状态读写；解耦评估：同领域纯类型声明。 */
import type {IAVLocateRequest} from "../locate.types";
/** 用途：完整定位注册状态；使用范围：惰性初始化；解耦评估：同领域纯类型声明。 */
import type {AVLocateRegistryState} from "../locate.types";

/** 获取或初始化 AV 定位完整注册状态。 @同步豁免: 生命周期 */
export const getAVLocateRegistry = () => {
    const current = getSForgeState(AV_LOCATE_REGISTRY);
    if (current) {
        return current;
    }
    const registry: AVLocateRegistryState = {
        locateRequests: new WeakMap(),
        queuedLocateRequests: new Map(),
        renderTokens: new WeakMap(),
        renderedAVData: new WeakMap(),
        highlightTokens: new WeakMap(),
        highlightStates: new WeakMap(),
        activeHighlights: new Set(),
    };
    setSForgeState(AV_LOCATE_REGISTRY, registry);
    return registry;
};

/** 开始一次 AV 渲染并登记过期隔离 token。 @同步豁免: 生命周期 - token 必须先于请求同步写入。 */
export const beginAVRender = (blockElement: HTMLElement) => {
    const token = Symbol();
    getAVLocateRegistry().renderTokens.set(blockElement, token);
    return token;
};

/** 判断渲染响应是否仍属于当前 AV 请求。 @同步豁免: 生命周期 - 响应提交 DOM 前必须同步判定。 */
export const isCurrentAVRender = (blockElement: HTMLElement, token: symbol) =>
    getAVLocateRegistry().renderTokens.get(blockElement) === token;

/** 写入当前元素的定位请求。 @同步豁免: 生命周期 - 根渲染启动前必须同步可见。 */
export const setAVLocateRequest = (blockElement: HTMLElement, request: IAVLocateRequest) => {
    getAVLocateRegistry().locateRequests.set(blockElement, request);
};

/** 读取当前元素的定位请求。 @同步豁免: 生命周期 - 同次渲染阶段连续读取。 */
export const getAVLocateRequest = (blockElement: HTMLElement) =>
    getAVLocateRegistry().locateRequests.get(blockElement);

/** 仅在身份仍匹配时清除定位请求，避免旧完成流程删除新请求。 @同步豁免: 生命周期 - 比较与删除必须原子完成。 */
export const clearAVLocateRequest = (blockElement: HTMLElement, request: IAVLocateRequest) => {
    const requests = getAVLocateRegistry().locateRequests;
    // 仅清除仍为同一对象的请求，避免旧响应删除后续定位。
    if (requests.get(blockElement) === request) {
        requests.delete(blockElement);
    }
};

/** 缓存最近一次已渲染 AV 数据，供同视图定位直接复用。 @同步豁免: 生命周期 - 完成渲染时立即登记。 */
export const setRenderedAVData = (blockElement: HTMLElement, data: IAV) => {
    getAVLocateRegistry().renderedAVData.set(blockElement, data);
};

/** 读取最近一次已渲染 AV 数据。 @同步豁免: 生命周期 - 激活阶段同步决定是否复用。 */
export const getRenderedAVData = (blockElement: HTMLElement) =>
    getAVLocateRegistry().renderedAVData.get(blockElement);

/** 清除指定 AV 的当前高亮生命周期。 @同步豁免: 生命周期 - 新定位激活前必须同步撤销旧 timer 与 class。 */
export const clearLocatedHighlight = (blockElement: HTMLElement) => {
    const registry = getAVLocateRegistry();
    registry.highlightTokens.delete(blockElement);
    const state = registry.highlightStates.get(blockElement);
    // 没有活动高亮时只需清除 token。
    if (!state) {
        return;
    }
    window.clearTimeout(state.timer);
    state.element.classList.remove(state.className);
    registry.highlightStates.delete(blockElement);
    registry.activeHighlights.delete(state);
};

/** 将当前定位请求投影为服务端 AV 渲染参数。 @同步豁免: 需要绝对同步的DOM访问 - 请求构造立即读取当前视图。 */
export const getAVLocateParams = (blockElement: HTMLElement, enabled = true) => {
    const request = getAVLocateRequest(blockElement);
    // 历史或快照渲染禁用定位参数时同步清除残留请求。
    if (!enabled && request) {
        clearAVLocateRequest(blockElement, request);
    }
    if (!enabled) {
        return;
    }
    // 首次切换目标视图前记录原视图，供完成阶段生成撤销事务。
    if (request?.viewID && request.previousViewID === undefined) {
        const focusedTab = blockElement.querySelector(".layout-tab-bar .item--focus");
        request.previousViewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) ||
            focusedTab?.getAttribute("data-id") || "";
    }
    return request ? {
        targetItemID: request.itemID,
        targetGroupID: request.groupID || "",
        viewID: request.viewID || blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || "",
    } : undefined;
};

/** 清除排队 timeout、高亮 DOM 和全部定位注册状态，供测试、HMR 与工作空间重置。 @同步豁免: 生命周期 - 重置必须同步阻断残留状态。 */
export const resetAVLocateRegistry = () => {
    const registry = getSForgeState(AV_LOCATE_REGISTRY);
    if (!registry) {
        return;
    }
    for (const {timer} of registry.queuedLocateRequests.values()) {
        window.clearTimeout(timer);
    }
    for (const state of registry.activeHighlights) {
        window.clearTimeout(state.timer);
        state.element.classList.remove(state.className);
    }
    setSForgeState(AV_LOCATE_REGISTRY, undefined);
};
