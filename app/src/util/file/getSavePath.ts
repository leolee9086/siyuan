import { fetchPost } from "../network/fetch";
import { getDisplayName, pathPosix } from "./path/operations";


const 创建保存路径响应处理器 = (
    pathString: string,
    notebookId: string,
    cb: (p: string, notebookId: string) => void
) => (data: IWebSocketData) => {
    if (!data.data) {
return;
}
    let targetPath = pathString;
    if (notebookId !== data.data.box) {
        targetPath = data.data.path || "/";
    }
    if (data.data.path?.startsWith("/")) {
        cb(getDisplayName(data.data.path, false, true), data.data.box);
        return;
    }
    if (data.data.path) {
        fetchPost("/api/filetree/getHPathByPath", {
            notebook: data.data.box,
            path: targetPath
        }, (response) => {
            cb(getDisplayName(pathPosix().join(response.data, data.data.path), false, true), data.data.box);
        });
        return;
    }
    fetchPost("/api/filetree/getHPathByPath", {
        notebook: data.data.box,
        path: targetPath
    }, (response) => {
        cb(getDisplayName(response.data, false, true), data.data.box);
    });
};

export const getSavePath = (pathString: string, notebookId: string, cb: (p: string, notebookId: string) => void) => {
    fetchPost("/api/filetree/getRefCreateSavePath", {
        notebook: notebookId
    }, 创建保存路径响应处理器(pathString, notebookId, cb));
};

