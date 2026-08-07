/** 用途：统一 Kernel 请求；使用范围：文件浏览器唯一仓储。 */
import {fetchSyncPost} from "./repository/imports";
/** 用途：校验外部响应；使用范围：根和目录 API 边界。 */
import {
    parseFileBrowserDirectoryPage,
    parseFileBrowserFileStat,
    parseFileBrowserRoots,
    parseFileBrowserTextPreview,
} from "./FileBrowser.guards";
/** 用途：文件浏览器仓储契约；使用范围：请求输入与公开实现。 */
import type {
    FileBrowserFileRequest,
    FileBrowserListRequest,
    FileBrowserPreviewRequest,
    FileBrowserRepository,
} from "./FileBrowser.types";

const ROOTS_ENDPOINT = "/api/s-forge/file-browser/roots";
const LIST_ENDPOINT = "/api/s-forge/file-browser/list";
const STAT_ENDPOINT = "/api/s-forge/file-browser/stat";
const PREVIEW_ENDPOINT = "/api/s-forge/file-browser/preview";

/** 在进入领域层前统一解释思源 API 包络。 */
export function requireFileBrowserResponseData(response: IWebSocketData, operation: string): unknown {
    if (response.code !== 0) {
        throw new Error(response.msg || `${operation}失败`);
    }
    if (!Object.prototype.hasOwnProperty.call(response, "data")) {
        throw new Error(`${operation}未返回数据`);
    }
    return response.data;
}

/** 枚举工作空间和全部历史 Agent 绑定根。 */
export async function listFileBrowserRoots() {
    const response = await fetchSyncPost(ROOTS_ENDPOINT, {});
    return parseFileBrowserRoots(requireFileBrowserResponseData(response, "读取文件根"));
}

/** 读取一个已授权根内的分页目录。 */
export async function listFileBrowserDirectory(request: FileBrowserListRequest) {
    const response = await fetchSyncPost(LIST_ENDPOINT, request);
    const page = parseFileBrowserDirectoryPage(requireFileBrowserResponseData(response, "读取目录"));
    if (page.root.id !== request.rootID || page.path !== request.path) {
        throw new Error("目录响应与请求节点不一致");
    }
    return page;
}

/** 读取文件统计和服务端生成的打开目标。 */
export async function statFileBrowserFile(request: FileBrowserFileRequest) {
    const response = await fetchSyncPost(STAT_ENDPOINT, request);
    const stat = parseFileBrowserFileStat(requireFileBrowserResponseData(response, "读取文件信息"));
    if (stat.root.id !== request.rootID || stat.entry.path !== request.path) {
        throw new Error("文件统计响应与请求地址不一致");
    }
    return stat;
}

/** 读取受限长度的文本预览。 */
export async function previewFileBrowserText(request: FileBrowserPreviewRequest) {
    const response = await fetchSyncPost(PREVIEW_ENDPOINT, request);
    const preview = parseFileBrowserTextPreview(requireFileBrowserResponseData(response, "读取文本预览"));
    if (preview.stat.root.id !== request.rootID || preview.stat.entry.path !== request.path) {
        throw new Error("文本预览响应与请求地址不一致");
    }
    return preview;
}

/** 默认仓储实例；控制器支持注入替身以验证竞态和失败状态。 */
export const fileBrowserRepository: FileBrowserRepository = {
    listRoots: listFileBrowserRoots,
    listDirectory: listFileBrowserDirectory,
    statFile: statFileBrowserFile,
    previewText: previewFileBrowserText,
};
