/** 用途：画廊结果状态和状态归约；使用范围：文件资源页签及其交互测试。 */
import type {
    FileBrowserAssetResult,
    FileBrowserSearchRequest,
    FileBrowserSearchResult,
} from "./FileBrowser.query.types";

export interface FileBrowserGalleryAsset extends FileBrowserAssetResult {
    key: string;
}

export type FileBrowserGalleryPhase = "loading" | "ready" | "empty" | "error";

export interface FileBrowserGalleryResultState {
    phase: FileBrowserGalleryPhase;
    assets: FileBrowserGalleryAsset[];
    totalCount: number;
    nextOffset: number;
    loadingMore: boolean;
    exhausted: boolean;
    error: string;
    pageError: string;
}

/** 内容区唯一允许的投影；资源数组和空态不能由两个独立来源分别决定。 */
export type FileBrowserGalleryContentState =
    | {kind: "loading"; assets: FileBrowserGalleryAsset[]}
    | {kind: "ready"; assets: FileBrowserGalleryAsset[]}
    | {kind: "empty"; assets: []}
    | {kind: "error"; assets: FileBrowserGalleryAsset[]};

export function createFileBrowserGalleryResult(
    phase: FileBrowserGalleryPhase = "loading",
): FileBrowserGalleryResultState {
    return {
        phase,
        assets: [],
        totalCount: 0,
        nextOffset: 0,
        loadingMore: false,
        exhausted: false,
        error: "",
        pageError: "",
    };
}

export function mapFileBrowserGalleryAssets(
    assets: readonly FileBrowserAssetResult[],
    makeKey: (asset: FileBrowserAssetResult) => string,
): FileBrowserGalleryAsset[] {
    return assets.map(asset => ({...asset, key: makeKey(asset)}));
}

export function applyFileBrowserGalleryInitialPage(
    page: FileBrowserSearchResult,
    request: FileBrowserSearchRequest,
    pageSize: number,
    makeKey: (asset: FileBrowserAssetResult) => string,
): FileBrowserGalleryResultState {
    const assets = mapFileBrowserGalleryAssets(page.assets, makeKey);
    const requestedLimit = request.limit ?? pageSize;
    const requestedOffset = request.offset ?? 0;
    return {
        phase: assets.length > 0 ? "ready" : "empty",
        assets,
        totalCount: page.totalCount,
        nextOffset: requestedOffset + Math.max(requestedLimit, assets.length),
        loadingMore: false,
        exhausted: assets.length === 0 || assets.length >= page.totalCount,
        error: "",
        pageError: "",
    };
}

export function appendFileBrowserGalleryPage(
    state: FileBrowserGalleryResultState,
    page: FileBrowserSearchResult,
    pageSize: number,
    makeKey: (asset: FileBrowserAssetResult) => string,
): FileBrowserGalleryResultState {
    const existing = new Map(state.assets.map(asset => [asset.key, asset]));
    for (const asset of mapFileBrowserGalleryAssets(page.assets, makeKey)) {
        existing.set(asset.key, asset);
    }
    const assets = [...existing.values()];
    const nextOffset = state.nextOffset + pageSize;
    return {
        ...state,
        phase: assets.length > 0 ? "ready" : "empty",
        assets,
        totalCount: page.totalCount,
        nextOffset,
        loadingMore: false,
        exhausted: page.assets.length === 0 || assets.length >= page.totalCount || nextOffset >= page.totalCount,
        pageError: "",
    };
}

/** 内容区只接受这个归约结果，避免旧卡片和空态同时作为有效视图存在。 */
export function deriveFileBrowserGalleryDisplayState(
    state: FileBrowserGalleryResultState,
    rootsLoading: boolean,
    rootsError: string,
): FileBrowserGalleryPhase {
    if (rootsLoading || state.phase === "loading") {
        return "loading";
    }
    if (rootsError || state.phase === "error") {
        return "error";
    }
    return state.assets.length > 0 ? "ready" : "empty";
}

/**
 * 将根加载和查询归约为内容区的单一判别状态。
 *
 * 这里返回资源数组的同一快照，模板只能从 `kind` 选择一个分支，避免
 * ready 网格和空态分别消费不同的 ref 后在一次更新中短暂并存。
 */
export function deriveFileBrowserGalleryContentState(
    state: FileBrowserGalleryResultState,
    rootsLoading: boolean,
    rootsError: string,
): FileBrowserGalleryContentState {
    const displayState = deriveFileBrowserGalleryDisplayState(state, rootsLoading, rootsError);
    if (displayState === "loading") {
        return {kind: "loading", assets: []};
    }
    if (displayState === "error") {
        return {kind: "error", assets: state.assets};
    }
    if (state.assets.length > 0) {
        return {kind: "ready", assets: state.assets};
    }
    return {kind: "empty", assets: []};
}
