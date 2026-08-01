/** 用途：约束标准对话框生命周期；使用范围：提示词文档选择。 */
import type {IDialog} from "./imports";
/** 用途：转义搜索结果；使用范围：提示词文档选择；解耦评估：纯字符串能力只由提示词网关暴露。 */
import {escapeHtml} from "./imports";
/** 用途：装配统一键盘导航；使用范围：提示词文档选择；解耦评估：搜索交互只由提示词网关暴露。 */
import {bindSearchListNavigation} from "./imports";
/** 用途：渲染统一文档结果；使用范围：提示词文档选择；解耦评估：搜索视图只由提示词网关暴露。 */
import {renderBlockSearchResultItem} from "./imports";
/** 用途：约束最终选择结果；使用范围：对话框结算。 */
import type {AgentPromptSourceDocument} from "./imports";
/** 用途：约束搜索候选；使用范围：结果渲染与选择。 */
import type {AgentPromptSourceDocumentCandidate} from "./imports";
/** 用途：调用提示词文档查询能力；使用范围：对话框生命周期。 */
import type {AgentPromptSourceRepository} from "./imports";
/** 用途：约束调用方注入的 Dialog 创建能力；使用范围：对话框上下文装配；解耦评估：复用完整宿主能力聚合。 */
import type {AgentPanelCapabilities} from "./imports";

const promptSourceDialogContent = /*html*/`<div class="b3-dialog__content agent-prompt-source-dialog">
    <label class="agent-prompt-source-dialog__search-label" for="agentPromptSourceSearch">搜索文档</label>
    <input id="agentPromptSourceSearch" class="b3-text-field fn__block" autocomplete="off" spellcheck="false">
    <div class="agent-prompt-source-dialog__hint">文档将在绑定时由 Kernel 读取并保存为独立快照。</div>
    <div class="b3-list agent-prompt-source-dialog__results" role="listbox"></div>
</div>
<div class="b3-dialog__action">
    <button type="button" class="b3-button b3-button--cancel" data-action="cancel">取消</button>
</div>`;

/** 只结算一次对话框 Promise，兼容选择完成后触发的销毁回调。 */
function settlePromptSourceDialog(
    state: {settled: boolean; resolve: (value: AgentPromptSourceDocument | null) => void},
    value: AgentPromptSourceDocument | null,
) {
    if (state.settled) {
        return;
    }
    state.settled = true;
    state.resolve(value);
}

/** 读取对话框必需元素，模板失配时由调用方立即结束生命周期。 */
function readPromptSourceDialogElements(dialog: IDialog) {
    const input = dialog.element.querySelector<HTMLInputElement>("#agentPromptSourceSearch");
    const results = dialog.element.querySelector<HTMLElement>(".agent-prompt-source-dialog__results");
    const cancel = dialog.element.querySelector<HTMLElement>('[data-action="cancel"]');
    if (!input || !results || !cancel) {
        return null;
    }
    return {input, results, cancel};
}

/** 创建一次完整的对话框上下文，并把销毁统一映射为取消结算。 */
function createPromptSourceDialogContext(
    repository: AgentPromptSourceRepository,
    createDialog: NonNullable<AgentPanelCapabilities["createDialog"]>,
    resolve: (value: AgentPromptSourceDocument | null) => void,
) {
    const state = {settled: false, searchVersion: 0, resolve};
    const dialog = createDialog({
        title: "选择系统提示词文档",
        width: "620px",
        content: promptSourceDialogContent,
        /** Dialog 被关闭时将尚未结算的文档选择统一提交为取消。 */
        destroyCallback: () => settlePromptSourceDialog(state, null),
    });
    const elements = readPromptSourceDialogElements(dialog);
    if (!elements) {
        dialog.destroy();
        return null;
    }
    return {repository, dialog, state, elements};
}

/** 将一个文档候选渲染为标准文件树结果按钮。 */
function renderPromptSourceCandidate(document: AgentPromptSourceDocumentCandidate, index: number) {
    return /*html*/`<button type="button" class="b3-list-item b3-list-item--two agent-prompt-source-dialog__result${index === 0 ? " b3-list-item--focus" : ""}" role="option"
    data-document-path="${escapeHtml(document.path)}" data-notebook-id="${escapeHtml(document.notebookId)}">
    ${renderBlockSearchResultItem({
        type: "NodeDocument",
        content: escapeHtml(document.title),
        hPath: escapeHtml(document.hPath),
        ial: {},
    })}
</button>`;
}

/** 禁用当前结果，避免解析同一候选期间再次提交选择。 */
function disablePromptSourceResults(results: HTMLElement) {
    for (const element of results.querySelectorAll<HTMLButtonElement>(".agent-prompt-source-dialog__result")) {
        element.disabled = true;
    }
}

/** 解析被点击的候选，并只在对话框仍活动时提交结果或显示错误。 */
async function selectPromptSourceCandidate(
    context: NonNullable<ReturnType<typeof createPromptSourceDialogContext>>,
    documents: AgentPromptSourceDocumentCandidate[],
    row: HTMLElement,
) {
    const candidate = documents.find((item) =>
        item.path === row.dataset.documentPath && item.notebookId === row.dataset.notebookId);
    if (!candidate || context.state.settled) {
        return;
    }
    disablePromptSourceResults(context.elements.results);
    try {
        const document = await context.repository.resolvePromptSourceDocument(candidate);
        settlePromptSourceDialog(context.state, document);
        context.dialog.destroy({confirmed: true});
    } catch (error) {
        if (context.state.settled) {
            return;
        }
        renderPromptSourceResults(context, documents, error instanceof Error ? error.message : String(error));
    }
}

/** 为当前结果集装配选择事件；重绘会连同旧节点一起释放旧监听器。 */
function bindPromptSourceResultEvents(
    context: NonNullable<ReturnType<typeof createPromptSourceDialogContext>>,
    documents: AgentPromptSourceDocumentCandidate[],
) {
    for (const row of context.elements.results.querySelectorAll<HTMLElement>(".agent-prompt-source-dialog__result")) {
        row.addEventListener("click", () => void selectPromptSourceCandidate(context, documents, row));
    }
}

/** 一次性投影搜索结果、空状态或错误状态。 */
function renderPromptSourceResults(
    context: NonNullable<ReturnType<typeof createPromptSourceDialogContext>>,
    documents: AgentPromptSourceDocumentCandidate[],
    error = "",
) {
    context.elements.results.innerHTML = "";
    if (error) {
        context.elements.results.insertAdjacentHTML(
            "beforeend",
            `<div class="agent-prompt-source-dialog__error" role="alert">${escapeHtml(error)}</div>`,
        );
    }
    // 搜索失败或没有候选时保持统一空状态，错误详情已在其上方独立呈现。
    if (documents.length === 0) {
        context.elements.results.insertAdjacentHTML(
            "beforeend",
            '<div class="agent-prompt-source-dialog__empty">没有可绑定的文档</div>',
        );
        return;
    }
    context.elements.results.insertAdjacentHTML("beforeend", documents.map(renderPromptSourceCandidate).join(""));
    bindPromptSourceResultEvents(context, documents);
}

/** 执行带版本号的搜索，只提交当前对话框最近一次请求。 */
async function searchPromptSourceDocuments(
    context: NonNullable<ReturnType<typeof createPromptSourceDialogContext>>,
) {
    const currentVersion = ++context.state.searchVersion;
    context.elements.results.innerHTML = '<div class="agent-prompt-source-dialog__empty">正在搜索文档...</div>';
    try {
        const documents = await context.repository.searchPromptSourceDocuments(context.elements.input.value);
        if (context.state.settled || currentVersion !== context.state.searchVersion) {
            return;
        }
        renderPromptSourceResults(context, documents);
    } catch (error) {
        if (context.state.settled || currentVersion !== context.state.searchVersion) {
            return;
        }
        renderPromptSourceResults(context, [], error instanceof Error ? error.message : String(error));
    }
}

/** 装配输入、取消和键盘导航，并触发初次搜索。 */
function activatePromptSourceDialog(context: NonNullable<ReturnType<typeof createPromptSourceDialogContext>>) {
    context.dialog.listen(context.elements.input, "input", () => void searchPromptSourceDocuments(context));
    context.dialog.listen(context.elements.cancel, "click", () => context.dialog.destroy());
    bindSearchListNavigation(context.elements.input, () => context.elements.results, {
        /** 将键盘确认复用为当前聚焦行的标准 click 流程。 */
        onSelect: (row) => row.click(),
        /** Escape 统一进入 Dialog 销毁和取消结算。 */
        onEscape: () => context.dialog.destroy(),
    });
    context.elements.input.focus();
    void searchPromptSourceDocuments(context);
}

/** 选择由 Kernel 再次读取并快照的文档。 */
export async function requestAgentPromptSourceDocument(
    repository: AgentPromptSourceRepository,
    createDialog: NonNullable<AgentPanelCapabilities["createDialog"]>,
) {
    return new Promise<AgentPromptSourceDocument | null>((resolve) => {
        const context = createPromptSourceDialogContext(repository, createDialog, resolve);
        if (!context) {
            return;
        }
        activatePromptSourceDialog(context);
    });
}
