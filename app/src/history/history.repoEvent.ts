import {confirmDialog} from "../dialog/confirmDialog";
import {Constants} from "../constants";
import {Dialog} from "../dialog";
import * as dayjs from "dayjs";
import {fetchPost} from "../util/network/fetch";
import {isMobile} from "../util/platform/functions";
import {showDiff} from "./diff";
import type { AppFacade } from "../app/AppFacade.types";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {renderRepo} from "./history.render";

export const handleRepoClick = (
    target: HTMLElement,
    type: string,
    event: MouseEvent,
    app: AppFacade,
    element: Element,
    repoElement: Element,
    repoSelectElement: HTMLSelectElement,
): boolean => {
    if (target.classList.contains("b3-list-item") && type === "repoitem" &&
        ["getRepoSnapshots", "getRepoTagSnapshots"].includes(repoSelectElement.value)) {
        const btnElement = element.querySelector(".b3-button[data-type='compare']");
        const idJSON = JSON.parse(btnElement.getAttribute("data-ids") || "[]");
        const id = target.getAttribute("data-id");
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
            while (idJSON.length > 1) {
                if (idJSON[0].id !== id) {
                    target.parentElement.querySelector(`.b3-list-item[data-id="${idJSON.splice(0, 1)[0].id}"]`)?.classList.remove("b3-list-item--focus");
                } else {
                    idJSON.splice(0, 1);
                }
            }
            idJSON.push({ id, time: target.querySelector('[data-type="hCreated"]').textContent });
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
        const textareaElement = genRepoDialog.element.querySelector("textarea");
        textareaElement.focus();
        const btnsElement = genRepoDialog.element.querySelectorAll(".b3-button");
        genRepoDialog.bindInput(textareaElement, () => {
            (btnsElement[1] as HTMLButtonElement).click();
        });
        btnsElement[0].addEventListener("click", () => {
            genRepoDialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            fetchPost("/api/repo/createSnapshot", { memo: textareaElement.value }, () => {
                renderRepo(repoElement, 1);
            });
            genRepoDialog.destroy();
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "removeRepoTagSnapshot" || type === "removeCloudRepoTagSnapshot") {
        const tag = target.parentElement.getAttribute("data-tag");
        confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.confirmDelete} <i>${tag}</i>?`, () => {
            fetchPost("/api/repo/" + type, { tag }, () => {
                renderRepo(repoElement, 1);
            });
        }, undefined, true);
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "uploadSnapshot") {
        fetchPost("/api/repo/uploadCloudSnapshot", {
            tag: target.parentElement.getAttribute("data-tag"),
            id: target.parentElement.getAttribute("data-id")
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "downloadSnapshot") {
        fetchPost("/api/repo/downloadCloudSnapshot", {
            tag: target.parentElement.getAttribute("data-tag"),
            id: target.parentElement.getAttribute("data-id")
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "downloadRollback" && !window.siyuan.config.readonly) {
        confirmDialog("⚠️ " + window.siyuan.languages.downloadRollback, window.siyuan.languages.rollbackConfirm.replace("${name}", window.siyuan.languages.workspaceData)
            .replace("${time}", (isMobile() ? target.parentElement.parentElement : target.parentElement).querySelector("span[data-type='hCreated']").textContent.trim()), () => {
                const repoId = target.parentElement.getAttribute("data-id");
                fetchPost("/api/repo/downloadCloudSnapshot", {
                    tag: target.parentElement.getAttribute("data-tag"),
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
        const inputElement = genTagDialog.element.querySelector(".b3-text-field") as HTMLInputElement;
        inputElement.select();
        const btnsElement = genTagDialog.element.querySelectorAll(".b3-button");
        btnsElement[0].addEventListener("click", () => {
            genTagDialog.destroy();
        });
        btnsElement[2].addEventListener("click", () => {
            fetchPost("/api/repo/tagSnapshot", {
                id: target.parentElement.getAttribute("data-id"),
                name: inputElement.value
            }, () => {
                fetchPost("/api/repo/uploadCloudSnapshot", {
                    tag: inputElement.value,
                    id: target.parentElement.getAttribute("data-id")
                }, () => {
                    renderRepo(repoElement, 1);
                });
            });
            genTagDialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            fetchPost("/api/repo/tagSnapshot", {
                id: target.parentElement.getAttribute("data-id"),
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
        const currentPage = parseInt(repoElement.getAttribute("data-page"));
        renderRepo(repoElement, type === "previous" ? currentPage - 1 : currentPage + 1);
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "jumpRepoPage") {
        const currentPage = parseInt(repoElement.getAttribute("data-page"));
        const totalPage = parseInt(target.getAttribute("data-totalpage") || "1");

        if (totalPage > 1) {
            confirmDialog(
                siyuanI18n.jumpToPage.replace("${x}", totalPage),
                `<input class="b3-text-field fn__block" type="number" min="1" max="${totalPage}" value="${currentPage}">`,
                (confirmD) => {
                    const inputElement = confirmD.element.querySelector(".b3-text-field") as HTMLInputElement;
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
