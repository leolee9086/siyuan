/** 用途：访问 session-panel 的跨目录 DOM 和会话依赖；使用范围：视图构建；解耦评估：统一由本目录网关显式暴露。 */
import * as imports from "./imports";
/** 用途：约束弹层 DOM、事件和渲染输入；使用范围：本视图模块；解耦评估：类型独立于 UI 实现。 */
import type * as types from "./types";

/** 创建会话弹层的稳定 DOM 骨架。 */
/** @同步豁免: UI构建 */
export function createAgentSessionPopup() {
    const popup = document.createElement("div");
    popup.className = "agent-session-popup b3-menu";
    popup.innerHTML = '<input class="b3-text-field agent-session-popup__search" placeholder="' +
        window.siyuan.languages.agentSessionSearch + '"><div class="b3-list b3-list--background fn__flex-1"></div>';
    const itemsContainer = popup.querySelector<HTMLElement>(".b3-list");
    const searchInput = popup.querySelector<HTMLInputElement>(".agent-session-popup__search");
    if (!itemsContainer || !searchInput) {
        throw new Error("failed to create Agent session popup");
    }
    return {
        popup,
        itemsContainer,
        searchInput,
    };
}

/** 将弹层挂载到宿主并对齐触发按钮。 */
/** @同步豁免: UI构建 */
export function mountAgentSessionPopup(elements: types.AgentSessionPopupElements, host: HTMLElement, trigger: HTMLElement) {
    host.appendChild(elements.popup);
    elements.popup.style.zIndex = (++window.siyuan.zIndex).toString();
    const triggerRect = trigger.getBoundingClientRect();
    imports.setPosition(elements.popup, triggerRect.right - 280, triggerRect.bottom, triggerRect.height, triggerRect.width);
    elements.searchInput.focus();
}

/** 绑定搜索、键盘导航和无限滚动事件。 */
/** @同步豁免: UI构建 */
export function bindAgentSessionPopupEvents(
    elements: types.AgentSessionPopupElements,
    handlers: types.AgentSessionPopupHandlers,
) {
    const {popup, itemsContainer, searchInput} = elements;
    searchInput.addEventListener("input", (event: InputEvent) => {
        event.stopPropagation();
        if (!event.isComposing) {
            handlers.onSearch(searchInput.value, itemsContainer);
        }
    });
    searchInput.addEventListener("compositionend", () => handlers.onSearch(searchInput.value, itemsContainer));
    searchInput.addEventListener("keydown", (event) => {
        if (!event.isComposing) {
            imports.upDownHint(itemsContainer, event);
        }
    });
    itemsContainer.addEventListener("scroll", () => {
        // 仅在视口到达列表底部时请求下一页，状态层会再判断是否已加载完。
        if (itemsContainer.scrollHeight - itemsContainer.scrollTop - itemsContainer.clientHeight <= 30) {
            handlers.onLoadMore(itemsContainer);
        }
    });
    popup.addEventListener("click", (event) => event.stopPropagation());
    bindAgentSessionPopupDismissal(handlers.onClose);
}

/** 绑定窗口变化和外部点击关闭，避免弹层脱离触发按钮或遗留在页面上。 */
function bindAgentSessionPopupDismissal(onClose: () => void) {
    const controller = new AbortController();
    window.addEventListener("resize", onClose, {signal: controller.signal});
    // 当前点击正在打开弹层，微任务使外部监听从下一个事件开始生效。
    queueMicrotask(() => document.addEventListener(
        "click",
        closeAgentSessionPopup.bind(null, onClose, controller),
        {once: true, signal: controller.signal},
    ));
}

/** 关闭会话弹层并中止本次挂载的全局监听器。 */
function closeAgentSessionPopup(onClose: () => void, controller: AbortController) {
    onClose();
    controller.abort();
}

/** 渲染会话列表，追加模式用于分页加载。 */
/** @同步豁免: UI构建 */
export function renderAgentSessionItems(
    container: HTMLElement,
    listItems: imports.SessionIndexItem[],
    options: types.AgentSessionRenderOptions,
) {
    const html = listItems.length === 0 && !options.append
        ? '<div class="b3-list--empty"><span class="b3-list-item__text">' + window.siyuan.languages.emptyContent + "</span></div>"
        : listItems.map((item) => renderAgentSessionItem(item, options)).join("");
    if (!options.append) {
        container.innerHTML = html;
        ensureAgentSessionFocus(container);
        return;
    }
    container.insertAdjacentHTML("beforeend", html);
    ensureAgentSessionFocus(container);
}

/** 确保列表在没有当前会话时仍有一个键盘导航起点。 */
function ensureAgentSessionFocus(container: HTMLElement) {
    // 当前会话不在本页且列表非空时，以第一行作为默认焦点。
    if (!container.querySelector(".b3-list-item--focus, .b3-list--empty")) {
        container.firstElementChild?.classList.add("b3-list-item--focus");
    }
}

/** 将单条会话转换为已转义的列表行 HTML，供初始渲染和追加分页共用。 */
function renderAgentSessionItem(item: imports.SessionIndexItem, options: types.AgentSessionRenderOptions) {
    const title = imports.escapeHtml(item.title || options.defaultTitle);
    const activeClass = item.id === options.currentId ? " b3-list-item--focus" : "";
    const moreLabel = window.siyuan.languages.more || "More";
    return '<div class="b3-list-item b3-list-item--hide-action' + activeClass + '" data-id="' + item.id + '">' +
        '<span class="b3-list-item__text ariaLabel" data-position="parentW" aria-label="' + title + '">' + title + "</span>" +
        '<span class="b3-list-item__action b3-tooltips b3-tooltips__nw" data-id="' + item.id + '" aria-label="' + window.siyuan.languages.rename + '"><svg><use xlink:href="#iconEdit"></use></svg></span>' +
        '<span class="b3-list-item__action b3-tooltips b3-tooltips__nw agent-session-more" data-id="' + item.id + '" aria-label="' + moreLabel + '" aria-haspopup="menu" aria-expanded="false"><svg><use xlink:href="#iconMore"></use></svg></span>' +
        "</div>";
}

/** 通过事件委托处理切换、重命名和顶层更多菜单。 */
/** @同步豁免: UI构建 */
export function bindAgentSessionListEvents(container: HTMLElement, handlers: types.AgentSessionListHandlers) {
    if (container.dataset.eventsBound) {
        return;
    }
    container.dataset.eventsBound = "1";
    container.addEventListener("click", handleAgentSessionListClick.bind(null, handlers));
}

/** 处理列表委托点击，先分流行动作，再处理会话切换。 */
function handleAgentSessionListClick(handlers: types.AgentSessionListHandlers, event: MouseEvent) {
    if (!(event.target instanceof Node)) {
        return;
    }
    const target = event.target;
    const action = imports.hasClosestByClassName(target, "b3-list-item__action");
    if (handleAgentSessionAction(event, action, handlers) || imports.hasClosestByClassName(target, "b3-text-field")) {
        return;
    }
    const item = imports.hasClosestByClassName(target, "b3-list-item");
    const id = item && item.getAttribute("data-id") || "";
    // 只在点击其它有效会话时切换，避免重复加载当前会话。
    if (id && id !== handlers.getCurrentSessionId()) {
        handlers.onSwitch(id);
    }
}

/** 分流会话行中的“更多”和重命名动作，并向调用方返回是否已消费点击。 */
function handleAgentSessionAction(
    event: MouseEvent,
    action: HTMLElement | false,
    handlers: types.AgentSessionListHandlers,
) {
    if (!action) {
        return false;
    }
    event.stopPropagation();
    const id = action.getAttribute("data-id") || "";
    if (!id) {
        return true;
    }
    // “更多”需要将当前按钮作为顶层菜单锚点，不进入重命名流程。
    if (action.classList.contains("agent-session-more")) {
        handlers.onMore(action, id);
        return true;
    }
    if (action.parentElement) {
        handlers.onRename(id, action.parentElement);
    }
    return true;
}

/** 将标题替换为单次编辑输入框。 */
/** @同步豁免: UI构建 */
export function startAgentSessionRename(
    row: HTMLElement,
    onFinish: (result: types.AgentSessionRenameResult) => void,
) {
    const titleElement = row.querySelector<HTMLElement>(".b3-list-item__text");
    if (!titleElement) {
        return;
    }
    const oldTitle = titleElement.textContent || "";
    const input = document.createElement("input");
    input.type = "text";
    input.value = oldTitle;
    input.className = "b3-text-field b3-text-field--small fn__flex-1";
    titleElement.replaceWith(input);
    input.focus();
    input.select();
    input.addEventListener("blur", () => onFinish({newTitle: input.value, input, titleElement}));
    input.addEventListener("keydown", handleAgentSessionRenameKeydown.bind(null, oldTitle, input));
}

/** 处理重命名键盘提交和取消，两者都通过 blur 统一完成流程。 */
function handleAgentSessionRenameKeydown(oldTitle: string, input: HTMLInputElement, event: KeyboardEvent) {
    if (event.isComposing) {
        return;
    }
    // Enter 提交当前值，通过 blur 统一走完成回调。
    if (event.key === "Enter") {
        input.blur();
        return;
    }
    // Escape 恢复旧标题后再触发同一完成回调。
    if (event.key === "Escape") {
        input.value = oldTitle;
        input.blur();
    }
}

/** 在当前会话行添加选中标记。 */
/** @同步豁免: UI构建 */
export function highlightCurrentAgentSession(popup: HTMLElement | null, currentId: string) {
    if (!popup) {
        return;
    }
    const checked = popup.querySelector(".b3-menu__checked");
    checked?.remove();
    for (const item of popup.querySelectorAll(".b3-list-item")) {
        // 会话 ID 匹配时只标记该行并立即结束扫描。
        if (item.getAttribute("data-id") === currentId) {
            item.insertAdjacentHTML("beforeend", '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg>');
            return;
        }
    }
}
