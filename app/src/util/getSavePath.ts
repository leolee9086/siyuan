import { fetchPost } from "./fetch";
import { getDisplayName, pathPosix } from "./pathName";


export const getSavePath = (pathString: string, notebookId: string, cb: (p: string, notebookId: string) => void) => {
    fetchPost("/api/filetree/getRefCreateSavePath", {
        notebook: notebookId
    }, (data) => {
        let targetPath = pathString;
        if (notebookId !== data.data.box) {
            targetPath = data.data.path || "/";
        }
        if (data.data.path) {
            if (data.data.path.startsWith("/")) {
                cb(getDisplayName(data.data.path, false, true), data.data.box);
            } else {
                fetchPost("/api/filetree/getHPathByPath", {
                    notebook: data.data.box,
                    path: targetPath
                }, (response) => {
                    cb(getDisplayName(pathPosix().join(response.data, data.data.path), false, true), data.data.box);
                });
            }
        } else {
            fetchPost("/api/filetree/getHPathByPath", {
                notebook: data.data.box,
                path: targetPath
            }, (response) => {
                cb(getDisplayName(response.data, false, true), data.data.box);
            });
        }
    });
};
