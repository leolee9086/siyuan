/** 用途：统一 Kernel POST；使用范围：属性 Dock 仓储。 */
import {fetchSyncPost} from "./repository/imports";
/** 用途：复用文件浏览 API 包络解释；使用范围：属性响应。 */
import {requireFileBrowserResponseData} from "./FileBrowser.repository";
/** 用途：属性响应运行时校验；使用范围：网络边界。 */
import {
    parseFilePropertiesInspectResult,
    parseFilePropertiesUpdateResult,
} from "./FileProperties.guards";
/** 用途：请求和仓储契约；使用范围：默认实现。 */
import type {FileBrowserFileRequest} from "./FileBrowser.types";
import type {
    FilePropertiesRepository,
    FilePropertiesUpdateItem,
} from "./FileProperties.types";

const INSPECT_ENDPOINT = "/api/s-forge/file-browser/properties";
const UPDATE_ENDPOINT = "/api/s-forge/file-browser/properties/set";

function sameAddress(left: FileBrowserFileRequest, right: FileBrowserFileRequest) {
    return left.rootID === right.rootID && left.path === right.path;
}

function requireMatchingAddresses(
    expected: FileBrowserFileRequest[],
    actual: Array<{request: FileBrowserFileRequest}>,
    operation: string,
) {
    if (expected.length !== actual.length || expected.some((request, index) => {
        const responseItem = actual[index];
        return !responseItem || !sameAddress(request, responseItem.request);
    })) {
        throw new Error(`${operation}响应与选择地址不一致`);
    }
}

/** 批量读取当前选择的物理属性和私有元数据。 */
export async function inspectFileProperties(items: FileBrowserFileRequest[]) {
    const response = await fetchSyncPost(INSPECT_ENDPOINT, {items});
    const result = parseFilePropertiesInspectResult(requireFileBrowserResponseData(response, "读取文件属性"));
    requireMatchingAddresses(items, result.items, "文件属性");
    return result;
}

/** 以逐项 revision 前置条件批量更新私有元数据。 */
export async function updateFileProperties(items: FilePropertiesUpdateItem[]) {
    const response = await fetchSyncPost(UPDATE_ENDPOINT, {items});
    const result = parseFilePropertiesUpdateResult(requireFileBrowserResponseData(response, "更新文件属性"));
    requireMatchingAddresses(items.map(item => item.request), result.items, "文件属性更新");
    return result;
}

export const filePropertiesRepository: FilePropertiesRepository = {
    inspect: inspectFileProperties,
    update: updateFileProperties,
};
