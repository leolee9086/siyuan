/// #if !BROWSER
/// #endif
import { confirmDialog } from "../dialog/confirmDialog";
import { isMobile } from "../util/functions";
import { movePathTo, moveToPath } from "../util/pathName";
import { MenuItem } from "./Menu.Item";
import { onExport, saveExport } from "../protyle/export";
import { isInAndroid, isInHarmony, isInIOS, openByMobile } from "../protyle/util/compatibility";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { hideMessage, showMessage } from "../dialog/message";
import { Dialog } from "../dialog";
import { focusBlock } from "../protyle/util/selection";
/// #if !MOBILE
/// #endif
import { rename, replaceFileName } from "../editor/rename";
import * as dayjs from "dayjs";
import { Constants } from "../constants";
import { exportImage } from "../protyle/export/util";
import { copyTextByType } from "../protyle/toolbar/util";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig";
import { openFileAttr } from "./commonMenuItem.openFileAttr";
export const bindAttrInput = (inputElement: HTMLInputElement, id: string) => {
    inputElement.addEventListener("change", () => {
        fetchPost("/api/attr/setBlockAttrs", {
            id,
            attrs: { [inputElement.dataset.name]: inputElement.value }
        });
    });
};

export const openFileWechatNotify = (protyle: IProtyle) => {
    fetchPost("/api/block/getDocInfo", {
        id: protyle.block.rootID
    }, (response) => {
        const reminder = response.data.ial[Constants.CUSTOM_REMINDER_WECHAT];
        let reminderFormat = "";
        if (reminder) {
            reminderFormat = dayjs(reminder).format("YYYY-MM-DD HH:mm");
        }
        const dialog = new Dialog({
            width: isMobile() ? "92vw" : "50vw",
            title: siyuanI18n.wechatReminder,
            content: `<div class="b3-dialog__content custom-attr">
    <div class="fn__flex">
        <span class="ft__on-surface fn__flex-center" style="text-align: right;white-space: nowrap;width: 100px">${siyuanI18n.notifyTime}</span>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" type="datetime-local" max="9999-12-31 23:59" value="${reminderFormat}">
    </div>
    <div class="b3-label__text" style="text-align: center">${siyuanI18n.wechatTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.remove}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`
        });
        dialog.element.setAttribute("data-key", Constants.DIALOG_WECHATREMINDER);
        const btnsElement = dialog.element.querySelectorAll(".b3-button");
        btnsElement[0].addEventListener("click", () => {
            dialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            fetchPost("/api/block/setBlockReminder", { id: protyle.block.rootID, timed: "0" }, () => {
                dialog.destroy();
            });
        });
        btnsElement[2].addEventListener("click", () => {
            const date = dialog.element.querySelector("input").value;
            if (date) {
                if (new Date(date) <= new Date()) {
                    showMessage(siyuanI18n.reminderTip);
                    return;
                }
                fetchPost("/api/block/setBlockReminder", {
                    id: protyle.block.rootID,
                    timed: dayjs(date).format("YYYYMMDDHHmmss")
                }, () => {
                    dialog.destroy();
                });
            } else {
                showMessage(siyuanI18n.notEmpty);
            }
        });
    });
};

export const openAttr = (nodeElement: Element, focusName = "bookmark", protyle: IProtyle) => {
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return;
    }
    const id = nodeElement.getAttribute("data-node-id");
    fetchPost("/api/attr/getBlockAttrs", { id }, (response) => {
        openFileAttr(response.data, focusName, protyle);
    });
};

export { copySubMenu } from './commonMenuItem.copy'
export const exportMd = (id: string) => {
    if (window.siyuan.isPublish) {
        return;
    }
    return new MenuItem({
        id: "export",
        label: siyuanI18n.export,
        type: "submenu",
        icon: "iconUpload",
        submenu: [{
            id: "exportTemplate",
            label: siyuanI18n.template,
            iconClass: "ft__error",
            icon: "iconMarkdown",
            click: async () => {
                const result = await fetchSyncPost("/api/block/getRefText", { id: id });

                const dialog = new Dialog({
                    title: siyuanI18n.fileName,
                    content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
                    width: isMobile() ? "92vw" : "520px",
                });
                dialog.element.setAttribute("data-key", Constants.DIALOG_EXPORTTEMPLATE);
                const inputElement = dialog.element.querySelector("input") as HTMLInputElement;
                const btnsElement = dialog.element.querySelectorAll(".b3-button");
                dialog.bindInput(inputElement, () => {
                    (btnsElement[1] as HTMLButtonElement).click();
                });
                let name = replaceFileName(result.data);
                const maxNameLen = 32;
                if (name.length > maxNameLen) {
                    name = name.substring(0, maxNameLen);
                }
                inputElement.value = name;
                inputElement.focus();
                inputElement.select();
                btnsElement[0].addEventListener("click", () => {
                    dialog.destroy();
                });
                btnsElement[1].addEventListener("click", () => {
                    if (inputElement.value.trim() === "") {
                        inputElement.value = siyuanI18n.untitled;
                    } else {
                        inputElement.value = replaceFileName(inputElement.value);
                    }

                    if (name.length > maxNameLen) {
                        name = name.substring(0, maxNameLen);
                    }

                    fetchPost("/api/template/docSaveAsTemplate", {
                        id,
                        name: inputElement.value,
                        overwrite: false
                    }, response => {
                        if (response.code === 1) {
                            // 重名
                            confirmDialog(siyuanI18n.export, siyuanI18n.exportTplTip, () => {
                                fetchPost("/api/template/docSaveAsTemplate", {
                                    id,
                                    name: inputElement.value,
                                    overwrite: true
                                }, resp => {
                                    if (resp.code === 0) {
                                        showMessage(siyuanI18n.exportTplSucc);
                                    }
                                });
                            });
                            return;
                        }
                        showMessage(siyuanI18n.exportTplSucc);
                    });
                    dialog.destroy();
                });
            }
        }, {
            id: "exportSiYuanZip",
            label: "SiYuan .sy.zip",
            icon: "iconSiYuan",
            click: () => {
                const msgId = showMessage(siyuanI18n.exporting, -1);
                fetchPost("/api/export/exportSY", {
                    id,
                }, response => {
                    hideMessage(msgId);
                    openByMobile(response.data.zip);
                });
            }
        }, {
            id: "exportMarkdown",
            label: "Markdown .zip",
            icon: "iconMarkdown",
            click: () => {
                const msgId = showMessage(siyuanI18n.exporting, -1);
                fetchPost("/api/export/exportMd", {
                    id,
                }, response => {
                    hideMessage(msgId);
                    openByMobile(response.data.zip);
                });
            }
        }, {
            id: "exportImage",
            label: siyuanI18n.image,
            icon: "iconImage",
            click: () => {
                exportImage(id);
            }
        },
        /// #if !BROWSER
        {
            id: "exportPDF",
            label: "PDF",
            icon: "iconPDF",
            click: () => {
                saveExport({ type: "pdf", id });
            }
        }, {
            id: "exportHTML_SiYuan",
            label: "HTML (SiYuan)",
            iconClass: "ft__error",
            icon: "iconHTML5",
            click: () => {
                saveExport({ type: "html", id });
            }
        }, {
            id: "exportHTML_Markdown",
            label: "HTML (Markdown)",
            icon: "iconHTML5",
            click: () => {
                saveExport({ type: "htmlmd", id });
            }
        }, {
            id: "exportWord",
            label: "Word .docx",
            icon: "iconExact",
            click: () => {
                saveExport({ type: "word", id });
            }
        }, {
            id: "exportMore",
            label: siyuanI18n.more,
            icon: "iconMore",
            type: "submenu",
            submenu: [{
                id: "exportReStructuredText",
                label: "reStructuredText",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportReStructuredText", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportAsciiDoc",
                label: "AsciiDoc",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportAsciiDoc", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportTextile",
                label: "Textile",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportTextile", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportOPML",
                label: "OPML",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportOPML", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportOrgMode",
                label: "Org-Mode",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportOrgMode", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportMediaWiki",
                label: "MediaWiki",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportMediaWiki", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportODT",
                label: "ODT",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportODT", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportRTF",
                label: "RTF",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportRTF", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            }, {
                id: "exportEPUB",
                label: "EPUB",
                click: () => {
                    const msgId = showMessage(siyuanI18n.exporting, -1);
                    fetchPost("/api/export/exportEPUB", {
                        id,
                    }, response => {
                        hideMessage(msgId);
                        openByMobile(response.data.zip);
                    });
                }
            },
            ]
        },
        /// #else
        {
            id: "exportPDF",
            label: siyuanI18n.print,
            icon: "iconPDF",
            ignore: !isInAndroid() && !isInHarmony() && !isInIOS(),
            click: () => {
                const msgId = showMessage(siyuanI18n.exporting);
                const localData = window.siyuan.storage[Constants.LOCAL_EXPORTPDF];
                fetchPost("/api/export/exportPreviewHTML", {
                    id,
                    keepFold: localData.keepFold,
                    merge: localData.mergeSubdocs,
                }, async response => {
                    const servePath = window.location.protocol + "//" + window.location.host + "/";
                    const html = await onExport(response, undefined, servePath, { type: "pdf", id });
                    if (isInAndroid()) {
                        window.JSAndroid.print(response.data.name, html);
                    } else if (isInHarmony()) {
                        window.JSHarmony.print(response.data.name, html);
                    } else if (isInIOS()) {
                        window.webkit.messageHandlers.print.postMessage(response.data.name + Constants.ZWSP + html);
                    }

                    setTimeout(() => {
                        hideMessage(msgId);
                    }, 3000);
                });
            }
        }, {
            id: "exportHTML_SiYuan",
            label: "HTML (SiYuan)",
            iconClass: "ft__error",
            icon: "iconHTML5",
            click: () => {
                saveExport({ type: "html", id });
            }
        }, {
            id: "exportHTML_Markdown",
            label: "HTML (Markdown)",
            icon: "iconHTML5",
            click: () => {
                saveExport({ type: "htmlmd", id });
            }
        },
            /// #endif
        ]
    }).element;
};

export const renameMenu = (options: {
    path: string
    notebookId: string
    name: string,
    type: "notebook" | "file"
}) => {
    return new MenuItem({
        id: "rename",
        accelerator: getSiyuanConfig().keymap.editor.general.rename.custom,
        icon: "iconEdit",
        label: siyuanI18n.rename,
        click: () => {
            rename(options);
        }
    }).element;
};

export const movePathToMenu = (paths: string[]) => {
    return new MenuItem({
        id: "move",
        label: siyuanI18n.move,
        icon: "iconMove",
        accelerator: getSiyuanConfig().keymap.general.move.custom,
        click() {
            movePathTo((toPath, toNotebook) => {
                moveToPath(paths, toNotebook[0], toPath[0]);
            }, paths);
        }
    }).element;
};
