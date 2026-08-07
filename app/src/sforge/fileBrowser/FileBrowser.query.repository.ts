/** 用途：文件浏览器索引查询仓储；使用范围：标签/关键词/颜色检索控制器。 */
import {fetchSyncPost} from "./repository/imports";
import {parseFileBrowserSearchResult} from "./FileBrowser.query.guards";
import type {FileBrowserQueryRepository, FileBrowserSearchRequest} from "./FileBrowser.query.types";

const SEARCH_ENDPOINT = "/api/s-forge/file-browser/search";

/** 在 API 包络和领域响应守卫之间保持查询输入不变。 */
export async function searchFileBrowserAssets(request: FileBrowserSearchRequest) {
    const response = await fetchSyncPost(SEARCH_ENDPOINT, request);
    if (response.code !== 0) {
        throw new Error(response.msg || "文件查询失败");
    }
    if (!Object.prototype.hasOwnProperty.call(response, "data")) {
        throw new Error("文件查询未返回数据");
    }
    return parseFileBrowserSearchResult(response.data);
}

/** 默认查询仓储；查询输入仍可在控制器测试中替换。 */
export const fileBrowserQueryRepository: FileBrowserQueryRepository = {
    search: searchFileBrowserAssets,
};
