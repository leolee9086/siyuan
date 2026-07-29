/**
 * 检查 URI 是否使用 SiYuan 协议。
 * @同步豁免: URI 解析
 */
export const isSiYuanUriProtocol = (uri: URL | string | null | undefined): boolean => {
    try {
        if (uri == null) return false;

        const uriObj = uri instanceof URL ? uri : new URL(uri);
        if (uriObj.protocol === "siyuan:" || uriObj.protocol === "web+siyuan:") {
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
};

/**
 * 解析 `siyuan://blocks/ID` 及其显示和数据库定位参数。
 * @同步豁免: URI 解析
 */
export const parseSiYuanUriInfo = (uri: URL | string | null | undefined): ISiYuanUriBlockInfo | null => {
    try {
        if (uri == null) return null;

        const uriObj = uri instanceof URL ? uri : new URL(uri);
        if (!isSiYuanUriProtocol(uriObj)) {
            return null;
        }
        if (uriObj.hostname === "blocks" && /^\/\d{14}-\w{7}/.test(uriObj.pathname)) {
            const avItemID = uriObj.searchParams.get("avItemID") || undefined;
            const avViewID = uriObj.searchParams.get("avViewID") || undefined;
            const avGroupID = uriObj.searchParams.get("avGroupID") || undefined;
            const isNodeID = (id?: string) => !id || /^\d{14}-\w{7}$/.test(id);
            if (!isNodeID(avItemID) || !isNodeID(avViewID) || !isNodeID(avGroupID)) {
                return null;
            }
            const blockInfo: ISiYuanUriBlockInfo = {
                id: uriObj.pathname.substring(1, 1 + 22),
                focus: uriObj.searchParams.get("focus") === "1",
                fullscreen: uriObj.searchParams.get("fullscreen") === "1",
            };
            if (avItemID) {
                blockInfo.avItemID = avItemID;
            }
            if (avViewID) {
                blockInfo.avViewID = avViewID;
            }
            if (avGroupID) {
                blockInfo.avGroupID = avGroupID;
            }
            return blockInfo;
        }
        return null;
    } catch (error) {
        return null;
    }
};

/** 解析当前宿主传入的 SiYuan 块定位信息。 */
export const parseUriInfo = (): ISiYuanUriBlockInfo => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("url")) {
        const dataInfo = parseSiYuanUriInfo(searchParams.get("url"));
        if (dataInfo != null) {
            window.siyuan.editorIsFullscreen = dataInfo.fullscreen;
            return dataInfo;
        }
    }

    if (window.JSAndroid) {
        const dataInfo = parseSiYuanUriInfo(window.JSAndroid.getBlockURL());
        if (dataInfo != null) {
            window.siyuan.editorIsFullscreen = dataInfo.fullscreen;
            return dataInfo;
        }
    }

    // 支持通过 URL 查询字符串参数 `id` 和 `focus` 跳转到 Web 端指定块 https://github.com/siyuan-note/siyuan/pull/7086
    const fullscreen = searchParams.get("fullscreen") === "1";
    window.siyuan.editorIsFullscreen = fullscreen;
    return {
        id: searchParams.get("id") ?? "",
        focus: searchParams.get("focus") === "1",
        fullscreen,
    };
};
