/** 提供原生 Agent 文档系统提示词的检索选择界面；状态动作由输入区的标准菜单承载，正文始终由 Kernel 读取。 */
import {Dialog} from "../../../dialog";
import {escapeHtml} from "../../../util/DOM/escape";
import {bindSearchListNavigation} from "../../../search/blockPicker/bindSearchListNavigation";
import {renderBlockSearchResultItem} from "../../../search/blockPicker/renderBlockSearchResultItem";
import {SessionStore} from "./SessionStore";
import type {AgentPromptSourceDocument, AgentPromptSourceDocumentCandidate} from "./SessionStore.types";

function settlePromptSourceDialog<T>(state: {settled: boolean; resolve: (value: T) => void}, value: T) {
    if (state.settled) {
        return;
    }
    state.settled = true;
    state.resolve(value);
}

/** 选择由 Kernel 再次读取并快照的文档。 */
export function requestAgentPromptSourceDocument() {
    return new Promise<AgentPromptSourceDocument | null>((resolve) => {
        const state = {settled: false, resolve};
        const dialog = new Dialog({
            title: "选择系统提示词文档",
            width: "620px",
            content: /*html*/`<div class="b3-dialog__content agent-prompt-source-dialog">
    <label class="agent-prompt-source-dialog__search-label" for="agentPromptSourceSearch">搜索文档</label>
    <input id="agentPromptSourceSearch" class="b3-text-field fn__block" autocomplete="off" spellcheck="false">
    <div class="agent-prompt-source-dialog__hint">文档将在绑定时由 Kernel 读取并保存为独立快照。</div>
    <div class="b3-list agent-prompt-source-dialog__results" role="listbox"></div>
</div>
<div class="b3-dialog__action">
    <button type="button" class="b3-button b3-button--cancel" data-action="cancel">取消</button>
</div>`,
            destroyCallback: () => settlePromptSourceDialog<AgentPromptSourceDocument | null>(state, null),
        });
        const input = dialog.element.querySelector<HTMLInputElement>("#agentPromptSourceSearch");
        const results = dialog.element.querySelector<HTMLElement>(".agent-prompt-source-dialog__results");
        const cancel = dialog.element.querySelector<HTMLElement>('[data-action="cancel"]');
        if (!input || !results || !cancel) {
            dialog.destroy();
            return;
        }
        let searchTimer = 0;
        let searchVersion = 0;
        const renderResults = (documents: AgentPromptSourceDocumentCandidate[], error = "") => {
            results.innerHTML = "";
            if (error) {
                results.insertAdjacentHTML("beforeend", `<div class="agent-prompt-source-dialog__error" role="alert">${escapeHtml(error)}</div>`);
            }
            if (documents.length === 0) {
                results.insertAdjacentHTML("beforeend", '<div class="agent-prompt-source-dialog__empty">没有可绑定的文档</div>');
                return;
            }
            results.insertAdjacentHTML("beforeend", documents.map((document, index) => /*html*/`<button type="button" class="b3-list-item b3-list-item--two agent-prompt-source-dialog__result${index === 0 ? " b3-list-item--focus" : ""}" role="option"
    data-document-path="${escapeHtml(document.path)}" data-notebook-id="${escapeHtml(document.notebookId)}">
    ${renderBlockSearchResultItem({
        type: "NodeDocument",
        content: escapeHtml(document.title),
        hPath: escapeHtml(document.hPath),
        ial: {},
    })}
</button>`).join(""));
            for (const row of results.querySelectorAll<HTMLElement>(".agent-prompt-source-dialog__result")) {
                row.addEventListener("click", async () => {
                    const candidate = documents.find((item) => item.path === row.dataset.documentPath && item.notebookId === row.dataset.notebookId);
                    if (!candidate || state.settled) {
                        return;
                    }
                    for (const element of results.querySelectorAll<HTMLButtonElement>(".agent-prompt-source-dialog__result")) {
                        element.disabled = true;
                    }
                    try {
                        const document = await SessionStore.resolvePromptSourceDocument(candidate);
                        settlePromptSourceDialog(state, document);
                        dialog.destroy({confirmed: true});
                    } catch (error) {
                        if (state.settled) {
                            return;
                        }
                        renderResults(documents, error instanceof Error ? error.message : String(error));
                    }
                });
            }
        };
        const search = async () => {
            const currentVersion = ++searchVersion;
            results.innerHTML = '<div class="agent-prompt-source-dialog__empty">正在搜索文档...</div>';
            try {
                const documents = await SessionStore.searchPromptSourceDocuments(input.value);
                if (state.settled || currentVersion !== searchVersion) {
                    return;
                }
                renderResults(documents);
            } catch (error) {
                if (state.settled || currentVersion !== searchVersion) {
                    return;
                }
                renderResults([], error instanceof Error ? error.message : String(error));
            }
        };
        dialog.listen(input, "input", () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => void search(), 180);
        });
        dialog.listen(cancel, "click", () => dialog.destroy());
        bindSearchListNavigation(input, () => results, {
            onSelect: (row) => row.click(),
            onEscape: () => dialog.destroy(),
        });
        input.focus();
        void search();
    });
}
