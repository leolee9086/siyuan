import {Constants} from "../../../constants";
import {fetchPost} from "../../../util/network/fetch";
import {setNoteBook} from "../../../util/file/pathName";

/** 在当前展开目录采用手工排序时，刷新该目录以响应服务端排序事件。 */
export const refreshChangedFiletreeSort = (
    element: HTMLElement,
    data: {notebook: string; parentPath: string},
    render: (data: {files: IFile[]; box: string; path: string}) => void,
): void => {
    const notebookElement = element.querySelector(`ul[data-url="${data.notebook}"]`);
    if (!notebookElement) {
        return;
    }
    const sortMode = notebookElement.getAttribute("data-sortmode");
    if (sortMode !== "6" && !(sortMode === "15" && window.siyuan.config.fileTree.sort === 6)) {
        return;
    }
    const listPath = data.parentPath === "/" ? "/" : `${data.parentPath}.sy`;
    const liElement = notebookElement.querySelector(`li[data-path="${listPath}"]`);
    if (liElement?.nextElementSibling?.tagName !== "UL") {
        return;
    }
    fetchPost("/api/filetree/listDocsByPath", {
        notebook: data.notebook,
        path: listPath,
        app: Constants.SIYUAN_APPID,
    }, response => render(response.data));
};

/** 全局笔记本采用手工排序时，重新载入笔记本顺序。 */
export const refreshChangedNotebookSort = (init: (initial?: boolean) => void): void => {
    if (window.siyuan.config.fileTree.sort !== 6) {
        return;
    }
    setNoteBook(() => init(false));
};
