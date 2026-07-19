/** 用途：访问 session-panel 的跨目录 API、平台和路径依赖；使用范围：控制器动作；解耦评估：依赖集中在本目录网关中。 */
import * as imports from "./imports";
/** 用途：生成无前端授权门禁的目录命令；使用范围：顶层菜单；解耦评估：纯动作策略。 */
import {buildTaskDirectoryMenuActions} from "./menu.actions";
/** 用途：显示可主题化的路径输入框；使用范围：非 Electron 目录绑定；解耦评估：对话框工厂隔离 DOM 和生命周期。 */
import {requestAgentTaskDirectoryPath} from "./directory-path-dialog.factory";
/** 用途：构建和更新会话弹层 DOM；使用范围：面板视图；解耦评估：控制器不直接编写列表 DOM。 */
import * as view from "./view";
/** 用途：约束控制器输入和可变状态；使用范围：本模块全部辅助函数；解耦评估：契约独立于实现。 */
import type * as types from "./types";

const AGENT_SESSION_MENU_NAME = "agent-session-actions";

/**
 * 创建一个独立的会话面板状态和四个公开生命周期操作。
 */
/** @同步豁免: 生命周期 */
export function createAgentSessionPanelController(options: types.AgentSessionPanelOptions) {
    const state: types.AgentSessionPanelState = {
        options,
        popup: null,
        isRendering: false,
        items: [],
        total: 0,
        page: 0,
        isLoadingMore: false,
        searchTimer: null,
        searchKeyword: "",
    };
    return {
        toggle: toggleAgentSessionPanel.bind(null, state),
        close: closeAgentSessionPanel.bind(null, state),
        destroy: closeAgentSessionPanel.bind(null, state),
        refresh: refreshAgentSessionPanel.bind(null, state),
    };
}

/** 在触发按钮点击时打开或关闭会话弹层。 */
function toggleAgentSessionPanel(state: types.AgentSessionPanelState) {
    if (state.isRendering) {
        return;
    }
    if (state.popup) {
        closeAgentSessionPanel(state);
        return;
    }
    void renderAgentSessionPanel(state);
}

/** 关闭会话弹层并重置分页、搜索和菜单状态。 */
function closeAgentSessionPanel(state: types.AgentSessionPanelState) {
    closeAgentSessionMoreMenu();
    for (const popup of document.querySelectorAll(".agent-session-popup")) {
        popup.remove();
    }
    state.popup = null;
    state.searchKeyword = "";
    state.items = [];
    state.total = 0;
    state.page = 0;
    // 关闭时取消尚未触发的搜索防抖，避免已移除弹层被异步更新。
    if (state.searchTimer !== null) {
        clearTimeout(state.searchTimer);
        state.searchTimer = null;
    }
}

/** 读取首页会话，组装视图并挂载交互回调。 */
async function renderAgentSessionPanel(state: types.AgentSessionPanelState) {
    state.isRendering = true;
    closeAgentSessionPanel(state);
    try {
        const result = await imports.SessionStore.list({page: 1, pageSize: 30});
        state.items = result.sessions;
        state.total = result.total;
        state.page = 1;
        const elements = view.createAgentSessionPopup();
        state.popup = elements.popup;
        renderAgentSessionPage(state, {container: elements.itemsContainer, listItems: result.sessions, append: false});
        view.bindAgentSessionPopupEvents(elements, {
            onSearch: filterAgentSessions.bind(null, state),
            onLoadMore: loadMoreAgentSessions.bind(null, state),
            onClose: closeAgentSessionPanel.bind(null, state),
        });
        view.mountAgentSessionPopup(elements, state.options.host, state.options.triggerBtn);
    } finally {
        state.isRendering = false;
    }
}

/** 渲染一页会话并将行动作委托回当前控制器。 */
function renderAgentSessionPage(state: types.AgentSessionPanelState, page: types.AgentSessionPageRender) {
    view.renderAgentSessionItems(page.container, page.listItems, {
        currentId: state.options.getCurrentSessionId(),
        defaultTitle: state.options.getDefaultTitle(),
        append: page.append,
    });
    view.bindAgentSessionListEvents(page.container, {
        getCurrentSessionId: state.options.getCurrentSessionId,
        onMore: showAgentSessionMoreMenu.bind(null, state),
        onRename: startAgentSessionTitleRename.bind(null, state),
        onSwitch: switchAgentSession.bind(null, state),
    });
    view.highlightCurrentAgentSession(state.popup, state.options.getCurrentSessionId());
}

/** 在列表接近底部时加载下一页，并合并索引状态。 */
async function loadMoreAgentSessions(state: types.AgentSessionPanelState, container: HTMLElement) {
    if (state.isLoadingMore || state.items.length >= state.total) {
        return;
    }
    state.isLoadingMore = true;
    try {
        const result = await imports.SessionStore.list({page: state.page + 1, pageSize: 30, keyword: state.searchKeyword});
        state.page = result.page;
        state.items = state.items.concat(result.sessions);
        state.total = result.total;
        renderAgentSessionPage(state, {container, listItems: result.sessions, append: true});
    } finally {
        state.isLoadingMore = false;
    }
}

/** 更新搜索词并以 300ms 用户输入防抖启动后端查询。 */
function filterAgentSessions(state: types.AgentSessionPanelState, keyword: string, container: HTMLElement) {
    state.searchKeyword = keyword.trim();
    // 新输入会替代上一次未执行查询，避免旧结果覆盖新关键词。
    if (state.searchTimer !== null) {
        clearTimeout(state.searchTimer);
    }
    // 300ms 是可感知的输入防抖窗口，不能由渲染事件或微任务替代。
    state.searchTimer = window.setTimeout(applyAgentSessionFilter.bind(null, state, container), 300);
}

/** 执行最新搜索并用首页结果重置列表。 */
async function applyAgentSessionFilter(state: types.AgentSessionPanelState, container: HTMLElement) {
    const result = await imports.SessionStore.list({page: 1, pageSize: 30, keyword: state.searchKeyword});
    state.items = result.sessions;
    state.total = result.total;
    state.page = 1;
    state.searchTimer = null;
    renderAgentSessionPage(state, {container, listItems: result.sessions, append: false});
    container.scrollTop = 0;
    view.highlightCurrentAgentSession(state.popup, state.options.getCurrentSessionId());
}

/** 切换到另一会话前先关闭列表，避免旧行状态残留。 */
function switchAgentSession(state: types.AgentSessionPanelState, id: string) {
    closeAgentSessionPanel(state);
    void state.options.callbacks.onSwitch(id);
}

/** 将会话标题切换为行内编辑器并绑定完成回调。 */
// @柯里化 列表委托只提供 id/row，此处需要捕获当前面板状态以构造完成回调。
function startAgentSessionTitleRename(state: types.AgentSessionPanelState, id: string, row: HTMLElement) {
    view.startAgentSessionRename(row, finishAgentSessionTitleRename.bind(null, state, id));
}

/** 持久化新标题，还原标题节点并同步本地列表项。 */
async function finishAgentSessionTitleRename(state: types.AgentSessionPanelState, id: string, result: types.AgentSessionRenameResult) {
    const title = result.newTitle.trim() || state.options.getDefaultTitle();
    result.input.replaceWith(result.titleElement);
    result.titleElement.textContent = title;
    await state.options.callbacks.onRename(id, title);
    const listItem = state.items.find((item) => item.id === id);
    if (listItem) {
        listItem.title = title;
    }
}

/** 在会话广播或目录动作后重读当前搜索页。 */
async function refreshAgentSessionPanel(state: types.AgentSessionPanelState) {
    const container = state.popup?.querySelector<HTMLElement>(".b3-list");
    if (!container) {
        return;
    }
    const result = await imports.SessionStore.list({page: 1, pageSize: 30, keyword: state.searchKeyword});
    state.items = result.sessions;
    state.total = result.total;
    state.page = 1;
    renderAgentSessionPage(state, {container, listItems: result.sessions, append: false});
}

/** 为指定会话打开顶层标准菜单，并映射目录管理命令。 */
function showAgentSessionMoreMenu(state: types.AgentSessionPanelState, anchor: HTMLElement, id: string) {
    const session = state.items.find((item) => item.id === id);
    if (!session) {
        return;
    }
    const menu = window.siyuan.menus.menu;
    menu.remove();
    menu.element.setAttribute("data-name", AGENT_SESSION_MENU_NAME);
    anchor.setAttribute("aria-expanded", "true");
    menu.removeCB = () => anchor.setAttribute("aria-expanded", "false");
    if (imports.isElectron) {
        menu.addItem({
            icon: "iconFolder",
            label: window.siyuan.languages.showInFolder,
            click: imports.useShell.bind(null, "openPath", imports.path.join(
                window.siyuan.config.system.dataDir,
                "storage", "ai", "agent", "sessions", id,
            )),
        });
    }
    for (const action of buildTaskDirectoryMenuActions(session)) {
        menu.addItem({
            icon: action.icon,
            label: action.label,
            click: runTaskDirectoryAction.bind(null, state, id, action),
        });
    }
    menu.addItem({
        icon: "iconTrashcan",
        label: window.siyuan.languages.delete,
        warning: true,
        click: deleteAgentSession.bind(null, state, id),
    });
    const anchorRect = anchor.getBoundingClientRect();
    menu.popup({x: anchorRect.right, y: anchorRect.bottom, isLeft: true, h: anchorRect.height, w: anchorRect.width});
}

/** 删除会话后刷新已打开的列表。 */
async function deleteAgentSession(state: types.AgentSessionPanelState, id: string) {
    await state.options.callbacks.onDelete(id);
    await refreshAgentSessionPanel(state);
}

/** 按菜单动作类型分流主目录绑定、附加目录和解除操作。 */
function runTaskDirectoryAction(state: types.AgentSessionPanelState, id: string, action: imports.TaskDirectoryMenuAction) {
    // 主目录绑定固定为读写权限，不使用附加目录的 permission 字段。
    if (action.action === "bind-main") {
        void bindAgentTaskDirectory(state, {id, main: true, permission: ""});
        return;
    }
    // 附加目录按菜单携带的显式权限绑定。
    if (action.action === "add") {
        void bindAgentTaskDirectory(state, {id, main: false, permission: action.permission || "read-only"});
        return;
    }
    void unbindAgentTaskDirectory(state, id, action.directoryID || "main");
}

/** 请求用户选择的目录并调用主目录或附加目录 API。 */
async function bindAgentTaskDirectory(state: types.AgentSessionPanelState, input: types.AgentSessionDirectoryBindInput) {
    const selectedPath = await selectAgentTaskDirectoryPath();
    if (!selectedPath) {
        return;
    }
    if (input.main) {
        await imports.SessionStore.bindTaskDirectory(input.id, selectedPath);
        await refreshAgentSessionPanel(state);
        return;
    }
    await imports.SessionStore.addTaskDirectory(input.id, selectedPath, input.permission);
    await refreshAgentSessionPanel(state);
}

/** 解除指定目录 grant 后重读会话摘要。 */
async function unbindAgentTaskDirectory(state: types.AgentSessionPanelState, id: string, directoryID: string) {
    await imports.SessionStore.unbindTaskDirectory(id, directoryID);
    await refreshAgentSessionPanel(state);
}

/** 在 Electron 使用原生目录选择器，Web/移动端则输入 kernel 主机绝对路径。 */
async function selectAgentTaskDirectoryPath() {
    if (!imports.isElectron) {
        return requestAgentTaskDirectoryPath();
    }
    const result = await imports.ipcInvoke<{canceled: boolean; filePaths: string[]}>(imports.Constants.SIYUAN_GET, {
        cmd: "showOpenDialog",
        defaultPath: window.siyuan.config.system.homeDir,
        properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length !== 1) {
        return "";
    }
    return result.filePaths[0];
}

/** 仅在全局菜单属于会话动作时关闭，不干扰其它业务菜单。 */
function closeAgentSessionMoreMenu() {
    const menu = window.siyuan.menus.menu;
    // data-name 区分共用的全局菜单当前是否由会话面板持有。
    if (menu.element.getAttribute("data-name") === AGENT_SESSION_MENU_NAME) {
        menu.remove();
    }
}
