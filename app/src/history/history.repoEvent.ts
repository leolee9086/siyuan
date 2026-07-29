import {confirmDialog} from "../dialog/confirmDialog";
import {Constants} from "../constants";
import {Dialog} from "../dialog";
import dayjs from "dayjs";
import {fetchPost} from "../util/network/fetch";
import {isMobile} from "../util/platform/functions";
import {showDiff} from "./diff";
import type {AppFacade} from "../app/AppFacade.types";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {renderRepo} from "./history.render";
import {saveExportFile} from "../protyle/util/compatibility";
import {renderAssetsPreview} from "../asset/renderAssets";
import {disabledProtyle, onGet} from "../protyle/util/onGet";
import {pathPosix} from "../util/file/path/operations";
import {requireHistoryAttribute, requireHistoryElement} from "./history.dom";
import {getSiyuanConfig} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

export const handleRepoClick = (
    target: HTMLElement,
    type: string | null,
    event: MouseEvent,
    app: AppFacade,
    element: Element,
    repoElement: Element,
    repoSelectElement: HTMLSelectElement,
): boolean => {
    if (target.classList.contains("b3-list-item__action") &&
        type === "rollback" &&
        !getSiyuanConfig().readonly) {
        const itemElement = requireHistoryElement(
            target.closest(".b3-list-item") as HTMLElement | null,
            "repository history rollback item",
        );
        const dataType = requireHistoryAttribute(itemElement, "data-type");
        if (dataType !== "repoitem" && dataType !== "searchFileItem") {
            return false;
        }
        const name = dataType === "repoitem"
            ? siyuanI18n.workspaceData
            : requireHistoryElement(
                itemElement.querySelector<HTMLElement>(".b3-list-item__text"),
                "repository history rollback title",
            ).textContent.trim();
        const time = dataType === "repoitem"
            ? requireHistoryElement(
                itemElement.querySelector<HTMLElement>("[data-type='hCreated']"),
                "repository snapshot timestamp",
            ).textContent.trim()
            : dayjs(parseInt(requireHistoryAttribute(itemElement, "data-created"))).format("YYYY-MM-DD HH:mm:ss");
        confirmDialog(
            "⚠️ " + siyuanI18n.rollback,
            siyuanI18n.rollbackConfirm.replace("${name}", name).replace("${time}", time),
            () => {
                const id = requireHistoryAttribute(itemElement, "data-id");
                fetchPost(
                    dataType === "searchFileItem"
                        ? "/api/repo/rollbackRepoSnapshotFile"
                        : "/api/repo/checkoutRepo",
                    {id},
                );
            },
        );
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "saveAs") {
        const itemElement = requireHistoryElement(
            target.closest(".b3-list-item") as HTMLElement | null,
            "repository history export item",
        );
        fetchPost(
            "/api/repo/exportRepoFile",
            {id: requireHistoryAttribute(itemElement, "data-id")},
            (response) => {
                void saveExportFile(response.data.path);
            },
        );
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "view") {
        const itemElement = requireHistoryElement(
            target.closest(".b3-list-item") as HTMLElement | null,
            "repository history preview item",
        );
        const snapshotId = requireHistoryAttribute(itemElement, "data-snapshot");
        const previewDialog = new Dialog({
            title: requireHistoryElement(
                itemElement.querySelector<HTMLElement>(".b3-list-item__text"),
                "repository history preview title",
            ).textContent.trim(),
            content: '<div class="b3-dialog__content"><div style="border-radius: var(--b3-border-radius-b);"></div></div>',
            width: isMobile() ? "100vw" : "80vw",
            height: isMobile() ? "100dvh" : "70vh",
            disableAnimation: true,
        });
        const contentElement = requireHistoryElement(
            previewDialog.element.querySelector<HTMLElement>(".b3-dialog__content"),
            "repository history preview content",
        );
        fetchPost(
            "/api/repo/openRepoSnapshotFile",
            {id: requireHistoryAttribute(itemElement, "data-id")},
            (response) => {
                const extension = pathPosix().extname(response.data.content).toLowerCase();
                if (Constants.SIYUAN_ASSETS_IMAGE
                    .concat(Constants.SIYUAN_ASSETS_AUDIO)
                    .concat(Constants.SIYUAN_ASSETS_VIDEO)
                    .includes(extension)) {
                    requireHistoryElement(
                        contentElement.firstElementChild,
                        "repository history media preview",
                    ).innerHTML = renderAssetsPreview(response.data.content);
                } else if (response.data.displayInText) {
                    contentElement.innerHTML = '<textarea readonly class="b3-text-field fn__block" style="height: 100%"></textarea>';
                    requireHistoryElement(
                        contentElement.firstElementChild as HTMLTextAreaElement | null,
                        "repository history text preview",
                    ).value = response.data.content || response.data.title;
                } else {
                    const previewRoot = requireHistoryElement(
                        contentElement.firstElementChild as HTMLElement | null,
                        "repository history document preview",
                    );
                    const viewEditor = app.createProtyle(previewRoot, {
                        blockId: "",
                        action: [Constants.CB_GET_HISTORY],
                        history: {snapshot: snapshotId},
                        render: {
                            background: false,
                            gutter: false,
                            breadcrumb: false,
                            breadcrumbDocName: false,
                        },
                        typewriterMode: false,
                    });
                    disabledProtyle(viewEditor.protyle);
                    onGet({
                        data: response,
                        protyle: viewEditor.protyle,
                        action: [Constants.CB_GET_HISTORY, Constants.CB_GET_HTML],
                    });
                }
            },
        );
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "more") {
        const itemElement = requireHistoryElement(
            target.closest(".b3-list-item") as HTMLElement | null,
            "repository history details item",
        );
        itemElement.querySelectorAll(".b3-list-item__meta").forEach((metaElement) => {
            metaElement.classList.toggle("fn__none");
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (target.classList.contains("b3-list-item") && type === "repoitem" &&
        ["getRepoSnapshots", "getRepoTagSnapshots"].includes(repoSelectElement.value)) {
        const btnElement = requireHistoryElement(
            element.querySelector<HTMLButtonElement>(".b3-button[data-type='compare']"),
            "repository history compare button",
        );
        const idJSON = JSON.parse(btnElement.getAttribute("data-ids") || "[]");
        const id = requireHistoryAttribute(target, "data-id");
        if (target.classList.contains("b3-list-item--focus")) {
            target.classList.remove("b3-list-item--focus");
            idJSON.find((item: { id: string, time: string }, index: number) => {
                if (id === item.id) {
                    idJSON.splice(index, 1);
                    return true;
                }
            });
        } else {
            target.classList.add("b3-list-item--focus");
            const itemList = requireHistoryElement(target.parentElement, "repository history snapshot list");
            while (idJSON.length > 1) {
                if (idJSON[0].id !== id) {
                    itemList.querySelector(`.b3-list-item[data-id="${idJSON.splice(0, 1)[0].id}"]`)
                        ?.classList.remove("b3-list-item--focus");
                } else {
                    idJSON.splice(0, 1);
                }
            }
            idJSON.push({
                id,
                time: requireHistoryElement(
                    target.querySelector<HTMLElement>('[data-type="hCreated"]'),
                    "repository snapshot timestamp",
                ).textContent,
            });
        }

        if (idJSON.length === 2) {
            btnElement.removeAttribute("disabled");
        } else {
            btnElement.setAttribute("disabled", "disabled");
        }
        btnElement.setAttribute("data-ids", JSON.stringify(idJSON));
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "genRepo") {
        const genRepoDialog = new Dialog({
            title: siyuanI18n.snapshotMemo,
            content: `<div class="b3-dialog__content">
    <textarea class="b3-text-field fn__block" placeholder="${siyuanI18n.snapshotMemoTip}"></textarea>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
            width: isMobile() ? "92vw" : "520px",
        });
        genRepoDialog.element.setAttribute("data-key", Constants.DIALOG_SNAPSHOTMEMO);
        const textareaElement = requireHistoryElement(
            genRepoDialog.element.querySelector<HTMLTextAreaElement>("textarea"),
            "snapshot memo input",
        );
        textareaElement.focus();
        const btnsElement = genRepoDialog.element.querySelectorAll<HTMLButtonElement>(".b3-button");
        const cancelButton = requireHistoryElement(btnsElement.item(0), "snapshot memo cancel button");
        const confirmButton = requireHistoryElement(btnsElement.item(1), "snapshot memo confirm button");
        genRepoDialog.bindInput(textareaElement, () => {
            confirmButton.click();
        });
        cancelButton.addEventListener("click", () => {
            genRepoDialog.destroy();
        });
        confirmButton.addEventListener("click", () => {
            fetchPost("/api/repo/createSnapshot", {memo: textareaElement.value}, () => {
                renderRepo(repoElement, 1);
            });
            genRepoDialog.destroy();
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "removeRepoTagSnapshot" || type === "removeCloudRepoTagSnapshot") {
        const actionOwner = requireHistoryElement(target.parentElement, "tagged repository snapshot item");
        const tag = requireHistoryAttribute(actionOwner, "data-tag");
        confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.confirmDelete} <i>${tag}</i>?`, () => {
            fetchPost("/api/repo/" + type, { tag }, () => {
                renderRepo(repoElement, 1);
            });
        }, undefined, true);
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "uploadSnapshot") {
        const actionOwner = requireHistoryElement(target.parentElement, "cloud snapshot upload item");
        fetchPost("/api/repo/uploadCloudSnapshot", {
            tag: requireHistoryAttribute(actionOwner, "data-tag"),
            id: requireHistoryAttribute(actionOwner, "data-id")
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "downloadSnapshot") {
        const actionOwner = requireHistoryElement(target.parentElement, "cloud snapshot download item");
        fetchPost("/api/repo/downloadCloudSnapshot", {
            tag: requireHistoryAttribute(actionOwner, "data-tag"),
            id: requireHistoryAttribute(actionOwner, "data-id")
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "downloadRollback" && !getSiyuanConfig().readonly) {
        const actionOwner = requireHistoryElement(target.parentElement, "cloud snapshot rollback item");
        const timeContainer = isMobile()
            ? requireHistoryElement(actionOwner.parentElement, "mobile cloud snapshot details")
            : actionOwner;
        const time = requireHistoryElement(
            timeContainer.querySelector<HTMLElement>("span[data-type='hCreated']"),
            "cloud snapshot timestamp",
        ).textContent.trim();
        confirmDialog("⚠️ " + siyuanI18n.downloadRollback, siyuanI18n.rollbackConfirm
            .replace("${name}", siyuanI18n.workspaceData)
            .replace("${time}", time), () => {
                const repoId = requireHistoryAttribute(actionOwner, "data-id");
                fetchPost("/api/repo/downloadCloudSnapshot", {
                    tag: requireHistoryAttribute(actionOwner, "data-tag"),
                    id: repoId
                }, () => {
                    fetchPost("/api/repo/checkoutRepo", {
                        id: repoId
                    });
                });
            });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "genTag") {
        const genTagDialog = new Dialog({
            title: siyuanI18n.tagSnapshot,
            content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="${dayjs().format("YYYYMMDDHHmmss")}" placeholder="${siyuanI18n.tagSnapshotTip}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.tagSnapshot}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.tagSnapshotUpload}</button>
</div>`,
            width: isMobile() ? "92vw" : "520px",
        });
        genTagDialog.element.setAttribute("data-key", Constants.DIALOG_SNAPSHOTTAG);
        const inputElement = requireHistoryElement(
            genTagDialog.element.querySelector<HTMLInputElement>(".b3-text-field"),
            "snapshot tag input",
        );
        inputElement.select();
        const btnsElement = genTagDialog.element.querySelectorAll<HTMLButtonElement>(".b3-button");
        const cancelButton = requireHistoryElement(btnsElement.item(0), "snapshot tag cancel button");
        const tagButton = requireHistoryElement(btnsElement.item(1), "snapshot tag confirm button");
        const uploadButton = requireHistoryElement(btnsElement.item(2), "snapshot tag upload button");
        const actionOwner = requireHistoryElement(target.parentElement, "repository snapshot tag item");
        const snapshotId = requireHistoryAttribute(actionOwner, "data-id");
        cancelButton.addEventListener("click", () => {
            genTagDialog.destroy();
        });
        uploadButton.addEventListener("click", () => {
            fetchPost("/api/repo/tagSnapshot", {
                id: snapshotId,
                name: inputElement.value
            }, () => {
                fetchPost("/api/repo/uploadCloudSnapshot", {
                    tag: inputElement.value,
                    id: snapshotId
                }, () => {
                    renderRepo(repoElement, 1);
                });
            });
            genTagDialog.destroy();
        });
        tagButton.addEventListener("click", () => {
            fetchPost("/api/repo/tagSnapshot", {
                id: snapshotId,
                name: inputElement.value
            }, () => {
                renderRepo(repoElement, 1);
            });
            genTagDialog.destroy();
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if ((type === "previous" || type === "next") && target.getAttribute("disabled") !== "disabled") {
        const currentPage = parseInt(requireHistoryAttribute(repoElement, "data-page"));
        renderRepo(repoElement, type === "previous" ? currentPage - 1 : currentPage + 1);
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "jumpRepoPage") {
        const currentPage = parseInt(requireHistoryAttribute(repoElement, "data-page"));
        const totalPage = parseInt(target.getAttribute("data-totalpage") || "1");

        if (totalPage > 1) {
            confirmDialog(
                siyuanI18n.jumpToPage.replace("${x}", totalPage.toString()),
                `<input class="b3-text-field fn__block" type="number" min="1" max="${totalPage}" value="${currentPage}">`,
                (confirmD) => {
                    if (!confirmD) {
                        throw new Error("History view invariant failed: repository page jump dialog");
                    }
                    const inputElement = requireHistoryElement(
                        confirmD.element.querySelector<HTMLInputElement>(".b3-text-field"),
                        "repository page jump input",
                    );
                    if (inputElement.value === "") {
                        return;
                    }
                    let page = parseInt(inputElement.value);
                    page = Math.max(1, Math.min(page, totalPage));
                    renderRepo(repoElement, page);
                }
            );
        }
        return true;
    } else if (type === "compare" && !target.getAttribute("disabled")) {
        showDiff(app, JSON.parse(target.getAttribute("data-ids") || "[]"));
        event.stopPropagation();
        event.preventDefault();
        return true;
    }
    return false;
};
