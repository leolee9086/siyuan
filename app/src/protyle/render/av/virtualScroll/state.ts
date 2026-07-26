/** 用途：注册表唯一键。使用范围：状态初始化与重置；解耦评估：经本域网关直达全局 Symbol 声明。 */
import {AV_VIRTUAL_SCROLL_REGISTRY} from "./imports";
/** 用途：读取统一状态。使用范围：注册表全部同步查询；解耦评估：经本域网关直达唯一全局状态实现。 */
import {getSForgeState} from "./imports";
/** 用途：写入统一状态。使用范围：注册表初始化与重置；解耦评估：经本域网关直达唯一全局状态实现。 */
import {setSForgeState} from "./imports";
/** 用途：构造 AV 视图键。使用范围：数据源登记与查询；解耦评估：经本域网关直达协议常量所有者。 */
import {Constants} from "./imports";
/** 用途：单个 body 完整状态。使用范围：body 状态写入；解耦评估：同子域纯类型不加载实现。 */
import type {AVVirtualBodyState} from "./virtualScroll.types";
/** 用途：完整注册表状态。使用范围：注册表初始化；解耦评估：同子域纯类型不加载实现。 */
import type {AVVirtualScrollRegistryState} from "./virtualScroll.types";

/** 作用：生成 AV block 的视图级状态键；意图：隔离同一数据库的不同视图；调用时机：登记或读取渲染数据源。 */
const getDataSourceKey = (element: Element) =>
    String(element.getAttribute("data-av-id")) + String(element.getAttribute(Constants.CUSTOM_SY_AV_VIEW));

/** 读取表格或看板 view 的已加载项数；选择头统计虚拟窗口总量时调用。 */
const getLoadedCount = (view: IAVView) => {
    const rows = "rows" in view ? view.rows : undefined;
    if (Array.isArray(rows)) {
        return rows.length;
    }
    const cards = "cards" in view ? view.cards : undefined;
    return Array.isArray(cards) ? cards.length : 0;
};

/** 获取或初始化 AV 虚拟滚动的完整跨调用状态。 @同步豁免: 生命周期 */
export const getAVVirtualScrollRegistry = () => {
    const current = getSForgeState(AV_VIRTUAL_SCROLL_REGISTRY);
    if (current) {
        return current;
    }
    const registry: AVVirtualScrollRegistryState = {
        dataSources: new Map(),
        bodyStates: new WeakMap(),
        trimPending: new WeakSet(),
        lastScrollTop: undefined,
    };
    setSForgeState(AV_VIRTUAL_SCROLL_REGISTRY, registry);
    return registry;
};

/** 登记一次 AV 渲染的数据源，供裁剪与未渲染行操作共享。 @同步豁免: 生命周期 - 必须在同次渲染初始化 body 状态前完成登记。 */
export const registerAVVirtualDataSource = (blockElement: HTMLElement, protyle: IProtyle, data: IAV) => {
    getAVVirtualScrollRegistry().dataSources.set(getDataSourceKey(blockElement), {protyle, data});
};

/** 读取当前 AV block 登记的数据源。 @同步豁免: 性能考虑 - 滚动帧内必须立即取得数据，异步会跨帧并使 DOM 快照过期。 */
export const getAVVirtualDataSource = (blockElement: Element) =>
    getAVVirtualScrollRegistry().dataSources.get(getDataSourceKey(blockElement));

/** 读取指定 body 的虚拟滚动状态。 @同步豁免: 性能考虑 - 裁剪算法在同一动画帧同步计算和修改窗口。 */
export const getAVVirtualBodyState = (bodyElement: HTMLElement) =>
    getAVVirtualScrollRegistry().bodyStates.get(bodyElement);

/** 写入指定 body 的完整虚拟滚动状态。 @同步豁免: 性能考虑 - 必须与本帧 DOM 回填原子完成，避免下一滚动事件读到旧窗口。 */
export const setAVVirtualBodyState = (bodyElement: HTMLElement, state: AVVirtualBodyState) => {
    getAVVirtualScrollRegistry().bodyStates.set(bodyElement, state);
};

/** 读取 body 对应的当前 AV view 数据。 @同步豁免: 需要绝对同步的DOM访问 - 调用方紧接着按当前 body 插入未渲染行。 */
export const getAvBodyData = (bodyElement: HTMLElement) => {
    const blockElement = bodyElement.closest(".av");
    if (!blockElement) {
        return null;
    }
    const stored = getAVVirtualDataSource(blockElement);
    if (!stored) {
        return null;
    }
    const groupId = bodyElement.dataset.groupId;
    return groupId
        ? stored.data.view.groups.find((group: IAVView) => group.id === groupId) ?? null
        : stored.data.view;
};

/** 同步单行选择状态到虚拟滚动快照。 @同步豁免: 需要绝对同步的DOM访问 - 选择事件必须在更新表头前写入快照。 */
export const updateAVRowSelect = (bodyElement: HTMLElement, rowId: string, selected: boolean) => {
    const state = getAVVirtualBodyState(bodyElement);
    if (!state) {
        return;
    }
    if (!state.selectedRowIds) {
        state.selectedRowIds = new Set();
    }
    if (selected) {
        state.selectedRowIds.add(rowId);
        return;
    }
    state.selectedRowIds.delete(rowId);
};

/** 全量替换指定 body 的选择快照。 @同步豁免: 需要绝对同步的DOM访问 - 全选和清选后立即读取该快照刷新计数。 */
export const resetAVRowSelect = (bodyElement: HTMLElement, rowIds: string[]) => {
    const state = getAVVirtualBodyState(bodyElement);
    if (state) {
        state.selectedRowIds = new Set(rowIds);
    }
};

/** 返回选择计数；未登记虚拟状态时由调用方回到 DOM 统计。 @同步豁免: 需要绝对同步的DOM访问 - 表头刷新必须使用同次事件中的选择状态。 */
export const getAVSelectStat = (bodyElement: HTMLElement) => {
    const state = getAVVirtualBodyState(bodyElement);
    if (!state?.selectedRowIds) {
        return null;
    }
    return {selectCount: state.selectedRowIds.size, loadedCount: getLoadedCount(state.view)};
};

/** 清除全部虚拟滚动状态，供测试、HMR 与工作空间生命周期重置。 @同步豁免: 生命周期 */
export const resetAVVirtualScrollRegistry = () => {
    getSForgeState(AV_VIRTUAL_SCROLL_REGISTRY)?.dataSources.clear();
    setSForgeState(AV_VIRTUAL_SCROLL_REGISTRY, undefined);
};
