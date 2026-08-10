/** 用途：标签结果页签导航；使用范围：标签树和属性 Dock，共享全根查询契约。 */
import {FILE_BROWSER_GALLERY_TAB_TYPE} from "./FileBrowser.gallery.constants";
import type {AppFacade} from "./dock/imports";

/** 打开一个只携带标签来源条件的全根画廊页签。 */
export function openFileBrowserTagResults(app: AppFacade, tag: string) {
    const normalized = tag.trim();
    if (!normalized) {
        throw new Error("标签名称不能为空");
    }
    return app.openTab({
        custom: {
            title: `标签: ${normalized}`,
            icon: "iconTags",
            id: FILE_BROWSER_GALLERY_TAB_TYPE,
            data: {
                rootID: "global",
                path: "",
                name: `标签: ${normalized}`,
                scope: "global",
                query: {allRoots: true, tags: [normalized], matchAllTags: true, orderBy: "updated"},
            },
        },
    });
}
