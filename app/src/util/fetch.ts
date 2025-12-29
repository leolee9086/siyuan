import { Constants } from "../constants";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif
import { processMessage } from "./processMessage";
import { kernelError } from "../dialog/processSystem";
import { isWebSocketData } from "./fetch.guard";

const setupRequestData = (url: string, data?: any) => {
    if (!data) {
        return null;
    }
    const specialUrls = ["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
        "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"];
    if (specialUrls.includes(url)) {
        window.siyuan.reqIds[url] = new Date().getTime();
    }
    const isNotLocalGraph = data.type !== "local" || url !== "/api/graph/getLocalGraph";
    if (specialUrls.includes(url) && isNotLocalGraph) {
        data.reqId = window.siyuan.reqIds[url];
    }
    if (url === "/api/transactions") {
        data.reqId = new Date().getTime();
    }
    if (data instanceof FormData) {
        return data;
    }
    return JSON.stringify(data);
};

const handleFetchError = (url: string, data: any, e: Error) => {
    console.warn("fetch post failed [" + e + "], url [" + url + "]");
    if (url === "/api/transactions" && (e.message === "Failed to fetch" || e.message === "Unexpected end of JSON input")) {
        kernelError();
        return;
    }
    /// #if !BROWSER
    const isExitCall = url === "/api/system/exit" || url === "/api/system/setWorkspaceDir" || (
        ["/api/system/setUILayout"].includes(url) && data?.errorExit
    );
    if (isExitCall) {
        ipcRenderer.send(Constants.SIYUAN_QUIT, location.port);
    }
    /// #endif
};

const handleFetchResponse = (response: Response) => {
    if (response.status === 403 || response.status === 404) {
        return {
            data: null,
            msg: response.statusText,
            code: -response.status,
        };
    }
    if (401 == response.status) {
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") > -1) {
        return response.json();
    }
    return response.text();
};

const createPostResponseHandler = (url: string, cb?: (response: IWebSocketData) => void) => {
    return (response: IWebSocketData) => {
        if (typeof response === "string") {
            cb?.(response);
            return;
        }
        const specialUrls = ["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
            "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"];
        if (specialUrls.includes(url) && response.data?.reqId && window.siyuan.reqIds[url] && window.siyuan.reqIds[url] > response.data.reqId) {
            return;
        }
        if (!cb) {
            return;
        }
        const isMessage = typeof response === "object" && typeof response.msg === "string" && typeof response.code === "number";
        if (isMessage && processMessage(response)) {
            cb(response);
            return;
        }
        if (!isMessage) {
            cb(response);
        }
    };
};

export const fetchPost = (url: string, data?: any, cb?: (response: IWebSocketData) => void, headers?: IObject) => {
    const init: RequestInit = {
        method: "POST",
        body: setupRequestData(url, data),
    };
    if (headers) {
        init.headers = headers;
    }
    fetch(url, init)
        .then(handleFetchResponse)
        .then(createPostResponseHandler(url, cb))
        .catch((e) => handleFetchError(url, data, e));
};

export const fetchSyncPost = async (url: string, data?: any) => {
    const init: RequestInit = {
        method: "POST",
        body: setupRequestData(url, data),
    };
    const res = await fetch(url, init);
    const jsonResult: unknown = await res.json();
    if (!isWebSocketData(jsonResult)) {
        throw new Error(`fetchSyncPost: 响应格式不符合预期 (url: ${url})`);
    }
    processMessage(jsonResult);
    return jsonResult;
};

export const fetchGet = (url: string, cb: (response: IWebSocketData | IObject | string) => void) => {
    fetch(url)
        .then(handleFetchResponse)
        .then((response) => {
            cb(response);
        });
};
