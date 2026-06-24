import { showMessage } from "../../dialog/message";
import { getAllModels } from "../../layout/getAll";
import { hasClosestByClassName, hasTopClosestByTag } from "../../protyle/util/hasClosest";
import { getDockByType } from "../../layout/tabUtil";
import { Files } from "../../layout/dock/Files";
import { openFileById } from "../../editor/utils.openFileById";
import {isMobile} from "../../platform";
import { fetchPost } from "../network/fetch";
import { getDisplayName, getOpenNotebookCount, pathPosix } from "./pathName";
import { Constants } from "../../constants";
import { replaceFileName, validateName } from "../../editor/rename";
import { hideElements } from "../../protyle/ui/hideElements";
import { openMobileFileById } from "../../mobile/editor";
import { App } from "../../index";
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";

export const getNewFilePath = (useSavePath: boolean) => {
    let notebookId = "";
    let currentPath = "";
    if (!isMobile) {
        getAllModels().editor.find((item) => {
            const currentElement = item.parent.headElement;
            if (currentElement.classList.contains("item--focus")) {
                notebookId = item.editor.protyle.notebookId;
                if (useSavePath) {
                    currentPath = item.editor.protyle.path;
                } else {
                    currentPath = pathPosix().dirname(item.editor.protyle.path);
                }
                if (hasClosestByClassName(currentElement, "layout__wnd--active")) {
                    return true;
                }
            }
        });
        if (!notebookId) {
            const fileModel = getDockByType("file").data.file;
            if (fileModel instanceof Files) {
                const currentElement = fileModel.element.querySelector(".b3-list-item--focus");
                if (currentElement) {
                    const topElement = hasTopClosestByTag(currentElement, "UL");
                    if (topElement) {
                        notebookId = topElement.getAttribute("data-url");
                    }
                    const selectPath = currentElement.getAttribute("data-path");
                    if (useSavePath) {
                        currentPath = selectPath;
                    } else {
                        currentPath = pathPosix().dirname(selectPath);
                    }
                }
            }
        }
    }
    if (isMobile) {
        if (window.siyuan.mobile.editor && document.getElementById("empty").classList.contains("fn__none")) {
            notebookId = window.siyuan.mobile.editor.protyle.notebookId;
            if (useSavePath) {
                currentPath = window.siyuan.mobile.editor.protyle.path;
            } else {
                currentPath = pathPosix().dirname(window.siyuan.mobile.editor.protyle.path);
            }
        }
    }
    if (!notebookId) {
        window.siyuan.notebooks.find(item => {
            if (!item.closed) {
                notebookId = item.id;
                currentPath = "/";
                return true;
            }
        });
    }
    return { notebookId, currentPath };
};

export const newFile = (optios: {
    app: App,
    notebookId?: string,
    currentPath?: string,
    paths?: string[],
    useSavePath: boolean,
    name?: string,
    afterCB?: (id: string, title: string) => void
    listDocTree?: boolean
}) => {
    if (getOpenNotebookCount() === 0) {
        showMessage(siyuanI18n.newFileTip);
        return;
    }
    if (!optios.notebookId) {
        const resultData = getNewFilePath(optios.useSavePath);
        optios.notebookId = resultData.notebookId;
        optios.currentPath = resultData.currentPath;
    }
    fetchPost("/api/filetree/getDocCreateSavePath", { notebook: optios.notebookId }, (data) => {
        if (!optios.useSavePath) {
            data.data.box = optios.notebookId;
        }
        const docName = optios.name || siyuanI18n._kernel[16];
        const titleEmpty = !optios.name;
        if ((data.data.path.indexOf("/") > -1 && optios.useSavePath) || optios.name) {
            if (data.data.path.startsWith("/") || optios.currentPath === "/") {
                const createPath = pathPosix().join(data.data.path, docName);
                fetchPost("/api/filetree/createDocWithMd", {
                    notebook: data.data.box,
                    path: createPath,
                    // 根目录时无法确定 parentID
                    markdown: "",
                    titleEmpty,
                    listDocTree: optios.listDocTree
                }, response => {
                    if (optios.afterCB) {
                        optios.afterCB(response.data, pathPosix().basename(createPath));
                    }
                    if (!isMobile) {
                        openFileById({
                            app: optios.app,
                            id: response.data,
                            action: [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]
                        });
                    }
                    if (isMobile) {
                        openMobileFileById(optios.app, response.data, [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]);
                    }
                });
            } else {
                fetchPost("/api/filetree/getHPathByPath", {
                    notebook: data.data.box,
                    path: optios.notebookId === data.data.box ? (optios.currentPath.endsWith(".sy") ? optios.currentPath : optios.currentPath + ".sy") : (data.data.path || "/")
                }, (responseHPath) => {
                    const createPath = pathPosix().join(responseHPath.data, data.data.path, docName);
                    fetchPost("/api/filetree/createDocWithMd", {
                        notebook: data.data.box,
                        path: createPath,
                        parentID: getDisplayName(optios.currentPath, true, true),
                        markdown: "",
                        titleEmpty,
                        listDocTree: optios.listDocTree
                    }, response => {
                        if (optios.afterCB) {
                            optios.afterCB(response.data, pathPosix().basename(createPath));
                        }
                        if (!isMobile) {
                            openFileById({
                                app: optios.app,
                                id: response.data,
                                action: [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]
                            });
                        }
                        if (isMobile) {
                            openMobileFileById(optios.app, response.data, [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]);
                        }
                    });
                });
            }
        } else {
            const title = pathPosix().basename(data.data.path);
            if (!validateName(title)) {
                return;
            }
            if (optios.notebookId !== data.data.box) {
                const createPath = pathPosix().join(data.data.path || "/", docName);
                fetchPost("/api/filetree/createDocWithMd", {
                    notebook: data.data.box,
                    path: createPath,
                    markdown: "",
                    titleEmpty,
                    listDocTree: optios.listDocTree
                }, response => {
                    if (optios.afterCB) {
                        optios.afterCB(response.data, pathPosix().basename(createPath));
                    }
                    if (!isMobile) {
                        openFileById({
                            app: optios.app,
                            id: response.data,
                            action: [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]
                        });
                    }
                    if (isMobile) {
                        openMobileFileById(optios.app, response.data, [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]);
                    }
                });
                return;
            }

            const id = Lute.NewNodeID();
            const newPath = (pathPosix().join(getDisplayName(optios.currentPath, false, true), id + ".sy"));
            if (optios.paths) {
                optios.paths[optios.paths.indexOf(undefined)] = newPath;
            }
            fetchPost("/api/filetree/createDoc", {
                notebook: data.data.box,
                path: newPath,
                title,
                md: "",
                sorts: optios.paths,
                listDocTree: optios.listDocTree
            }, () => {
                if (optios.afterCB) {
                    optios.afterCB(id, title);
                }
                if (!isMobile) {
                    openFileById({ app: optios.app, id, action: [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW] });
                }
                if (isMobile) {
                    openMobileFileById(optios.app, id, [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]);
                }
            });
        }
    });
};

export const newFileByName = (app: App, value: string) => {
    hideElements(["dialog"]);
    newFile({
        app,
        useSavePath: true,
        name: replaceFileName(value.trim())
    });
};

export const newFileBySelect = (protyle: IProtyle, selectText: string, nodeElement: HTMLElement, pathDir: string, targetNotebookId: string) => {
    const newFileName = replaceFileName(selectText.trim() ? selectText.trim() : protyle.lute.BlockDOM2Content(nodeElement.outerHTML).replace(/\n/g, "").trim());
    const hPath = pathPosix().join(pathDir, newFileName || siyuanI18n._kernel[16]);
    fetchPost("/api/filetree/getIDsByHPath", {
        path: hPath,
        notebook: targetNotebookId
    }, (idResponse) => {
        const refText = newFileName.substring(0, window.siyuan.config.editor.blockRefDynamicAnchorTextMaxLen);
        if (idResponse.data && idResponse.data.length > 0) {
            const refElement = protyle.toolbar.setInlineMark(protyle, "block-ref", "range", {
                type: "id",
                color: `${idResponse.data[0]}${Constants.ZWSP}d${Constants.ZWSP}${refText}`
            });
            if (refElement[0]) {
                protyle.toolbar.range.selectNodeContents(refElement[0]);
            }
        } else {
            fetchPost("/api/filetree/createDocWithMd", {
                notebook: targetNotebookId,
                path: hPath,
                parentID: protyle.notebookId === targetNotebookId ? protyle.block.rootID : "",
                markdown: "",
                titleEmpty: newFileName === "",
            }, response => {
                const refElement = protyle.toolbar.setInlineMark(protyle, "block-ref", "range", {
                    type: "id",
                    color: `${response.data}${Constants.ZWSP}d${Constants.ZWSP}${refText}`
                });
                if (refElement[0]) {
                    protyle.toolbar.range.selectNodeContents(refElement[0]);
                }
            });
        }
        hideElements(["toolbar"], protyle);
    });
};
