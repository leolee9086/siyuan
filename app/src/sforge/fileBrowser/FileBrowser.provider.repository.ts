/** 用途：统一 Kernel 请求；使用范围：外部文件 provider 仓储。 */
import {fetchSyncPost} from "./repository/imports";
import {requireFileBrowserResponseData} from "./FileBrowser.repository";
import {
    assertClosedProviderSession,
    parseFileBrowserProviderDescriptors,
    parseFileBrowserProviderDirectoryPage,
    parseFileBrowserProviderEntryStat,
    parseFileBrowserProviderResourcePage,
    parseFileBrowserProviderSession,
} from "./FileBrowser.provider.guards";
import type {
    FileBrowserProviderEntryAddress,
    FileBrowserProviderListRequest,
    FileBrowserProviderPageRequest,
    FileBrowserProviderRepository,
    FileBrowserProviderSessionAddress,
    FileBrowserProviderSessionOpenRequest,
} from "./FileBrowser.types";

const PROVIDERS_ENDPOINT = "/api/s-forge/file-browser/providers";
const SESSION_OPEN_ENDPOINT = "/api/s-forge/file-browser/provider/session/open";
const SESSION_CLOSE_ENDPOINT = "/api/s-forge/file-browser/provider/session/close";
const RESOURCES_ENDPOINT = "/api/s-forge/file-browser/provider/resources";
const LIST_ENDPOINT = "/api/s-forge/file-browser/provider/list";
const STAT_ENDPOINT = "/api/s-forge/file-browser/provider/stat";

function sessionPayload(address: FileBrowserProviderSessionAddress) {
    return {provider: address.provider, session: address.session};
}

function locatorPayload(address: FileBrowserProviderListRequest["parent"] | FileBrowserProviderEntryAddress) {
    return {
        provider: address.provider,
        session: address.session,
        resource: address.resource,
        ...(address.kind === "provider-entry" ? {token: address.token} : {}),
    };
}

function isPrivateIPv4(hostname: string) {
    const parts = hostname.split(".").map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }
    const first = parts[0];
    const second = parts[1];
    return first === 10 || first === 127 ||
        (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254);
}

function isPrivateIPv6(hostname: string) {
    const host = hostname.replace(/^\[|\]$/g, "").split("%", 1)[0]?.toLowerCase() ?? "";
    if (host === "::1") {
        return true;
    }
    const first = Number.parseInt(host.split(":", 1)[0] ?? "", 16);
    return Number.isInteger(first) && ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80);
}

function isPrivateHTTPHostname(hostname: string) {
    const normalized = hostname.toLowerCase();
    return normalized === "localhost" || isPrivateIPv4(normalized) || isPrivateIPv6(normalized);
}

function normalizeSessionOpenRequest(request: FileBrowserProviderSessionOpenRequest) {
    let endpoint: URL;
    try {
        endpoint = new URL(request.endpoint ?? "");
    } catch {
        return {...request};
    }
    if (endpoint.protocol.toLowerCase() === "https:") {
        const encryptedRequest = {...request};
        delete encryptedRequest.insecureHTTPConfirmed;
        return encryptedRequest;
    }
    if (endpoint.protocol.toLowerCase() !== "http:") {
        return {...request};
    }
    if (request.insecureHTTPConfirmed !== true) {
        throw new Error("HTTP 端点会以未加密方式传输凭据，请显式确认后再连接");
    }
    if (!isPrivateHTTPHostname(endpoint.hostname)) {
        throw new Error("HTTP 端点仅允许 localhost、本机回环、私网或链路本地 IP 地址");
    }
    return {...request, insecureHTTPConfirmed: true};
}

/** 列出可建立 session 的 provider；catalog provider 仍保留在描述列表中。 */
export async function listFileBrowserProviders() {
    const response = await fetchSyncPost(PROVIDERS_ENDPOINT, {});
    return parseFileBrowserProviderDescriptors(requireFileBrowserResponseData(response, "读取文件 provider"));
}

/** 建立一个明确 provider 的 session，不从 endpoint 推断 provider 或设备。 */
export async function openFileBrowserProviderSession(request: FileBrowserProviderSessionOpenRequest) {
    const payload = normalizeSessionOpenRequest(request);
    const response = await fetchSyncPost(SESSION_OPEN_ENDPOINT, payload);
    return parseFileBrowserProviderSession(
        requireFileBrowserResponseData(response, "打开文件 provider 会话"),
        request.provider,
    );
}

/** 关闭精确 session；成功响应必须回显同一个 provider/session。 */
export async function closeFileBrowserProviderSession(address: FileBrowserProviderSessionAddress) {
    const response = await fetchSyncPost(SESSION_CLOSE_ENDPOINT, sessionPayload(address));
    assertClosedProviderSession(requireFileBrowserResponseData(response, "关闭文件 provider 会话"), address);
}

/** 分页读取一个 session 自己枚举出的资源，资源不跨 session 归并。 */
export async function listFileBrowserProviderResources(
    session: FileBrowserProviderSessionAddress,
    page: FileBrowserProviderPageRequest,
) {
    const response = await fetchSyncPost(RESOURCES_ENDPOINT, {...sessionPayload(session), page});
    return parseFileBrowserProviderResourcePage(
        requireFileBrowserResponseData(response, "读取文件 provider 资源"),
        session,
        page,
    );
}

/** 使用 resource 根或目录 token 读取下一层条目。 */
export async function listFileBrowserProviderDirectory(request: FileBrowserProviderListRequest) {
    const payload = {
        ...locatorPayload(request.parent),
        page: request.page,
        sort: [{field: request.sortBy === "updated" ? "modified" : request.sortBy,
            desc: request.sortDirection === "desc"}],
        directoriesFirst: request.directoriesFirst,
    };
    const response = await fetchSyncPost(LIST_ENDPOINT, payload);
    return parseFileBrowserProviderDirectoryPage(
        requireFileBrowserResponseData(response, "读取文件 provider 目录"),
        request.parent,
        request.page,
    );
}

/** 读取精确 opaque 条目地址的属性和内容入口。 */
export async function statFileBrowserProviderEntry(address: FileBrowserProviderEntryAddress) {
    const response = await fetchSyncPost(STAT_ENDPOINT, locatorPayload(address));
    return parseFileBrowserProviderEntryStat(
        requireFileBrowserResponseData(response, "读取文件 provider 条目信息"),
        address,
    );
}

export const fileBrowserProviderRepository: FileBrowserProviderRepository = {
    listProviders: listFileBrowserProviders,
    openSession: openFileBrowserProviderSession,
    closeSession: closeFileBrowserProviderSession,
    listResources: listFileBrowserProviderResources,
    listDirectory: listFileBrowserProviderDirectory,
    statEntry: statFileBrowserProviderEntry,
};
