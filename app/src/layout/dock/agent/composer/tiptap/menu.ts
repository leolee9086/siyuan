/** 用途：转义菜单展示文本；使用范围：Tiptap 的 @ 与 / 建议菜单；解耦评估：复用项目纯字符串能力。 */
import {escapeHtml} from "./imports";
/** 用途：创建标准菜单项；使用范围：Tiptap 的 @ 与 / 建议菜单；解耦评估：项目标准 MenuItem 是统一交互协议，不在 Composer 内复制 DOM。 */
import {MenuItem} from "./imports";
/** 用途：约束建议条目；使用范围：菜单渲染与选择命令。 */
import type {BlockHit} from "./types";
/** 用途：约束可观察菜单状态；使用范围：菜单渲染与键盘选择。 */
import type {SuggestionMenuState} from "./types";
/** 用途：聚合标准菜单打开参数；使用范围：菜单渲染入口。 */
import type {OpenSuggestionMenuOptions} from "./types";

/**
 * 作用：清空建议候选、选择和命令；意图：DOM 关闭与公开状态始终一致；
 * 调用时机：菜单移除前后或新菜单打开前；问题/改进：标准 Menu 的 removeCB 同步调用本函数。
 */
const resetSuggestionMenuState = (state: SuggestionMenuState) => {
    state.open = false;
    state.selectedIndex = 0;
    state.items = [];
    state.command = null;
};

/** @同步豁免: 生命周期 菜单关闭必须在当前点击、退出或销毁事件内完成，异步会留下可交互的过期 DOM。 */
/** 关闭当前 Composer 拥有的建议菜单，同时同步清空可观察选择状态。 */
export const closeTiptapSuggestionMenu = (state: SuggestionMenuState) => {
    // 只有当前状态仍拥有菜单时才移除全局标准菜单，避免空闲 Composer 误关其他菜单。
    if (state.open) {
        state.menu.remove();
    }
    resetSuggestionMenuState(state);
};

/**
 * 作用：把公开选择下标投影到标准菜单 current 类；意图：键盘状态与 DOM 高亮分离；
 * 调用时机：菜单打开或方向键移动后；问题/改进：候选数量与已追加标准行保持相同。
 */
const updateSuggestionHighlight = (state: SuggestionMenuState) => {
    const rows = state.menu.element.querySelectorAll(".b3-menu__item");
    let index = 0;
    for (const row of rows) {
        row.classList.toggle("b3-menu__item--current", index === state.selectedIndex);
        index++;
    }
};

/**
 * 作用：把领域候选映射为标准 MenuItem；意图：复用菜单点击关闭、图标和辅助文字协议；
 * 调用时机：每次打开或替换建议内容；问题/改进：文本在进入 MenuItem 前统一转义。
 */
const appendSuggestionRows = (state: SuggestionMenuState, items: BlockHit[]) => {
    for (const item of items) {
        const row = MenuItem.create({
            label: escapeHtml(item.label),
            ...(item.icon ? {icon: item.icon} : {}),
            ...(item.hPath ? {accelerator: escapeHtml(item.hPath)} : {}),
            /** 点击时读取当前公开命令，MenuItem 随后按标准协议触发关闭。 */
            click: () => state.command?.(item),
        }).element;
        state.menu.append(row);
    }
};

/** @同步豁免: UI构建 标准 Menu 的内容和定位必须在当前建议回调中同步完成，否则光标锚点会失效。 */
/** 用标准 Menu 替换当前全局菜单内容，并以光标矩形作为统一定位锚点。 */
export const openTiptapSuggestionMenu = (options: OpenSuggestionMenuOptions) => {
    const {state, items, command, clientRect} = options;
    state.menu.remove();
    resetSuggestionMenuState(state);
    // 空候选只负责关闭此前菜单，不创建空壳弹层。
    if (items.length === 0) {
        return;
    }
    state.menu.element.setAttribute("data-name", "agent-composer-suggestions");
    state.open = true;
    state.items = items;
    state.command = command;
    state.menu.removeCB = () => resetSuggestionMenuState(state);
    appendSuggestionRows(state, items);
    updateSuggestionHighlight(state);
    const rect = clientRect?.() ?? state.host.getBoundingClientRect();
    state.menu.popup({x: rect.left, y: rect.bottom + 4, h: rect.height + 8, w: rect.width});
};

/** 作用：循环移动公开选择下标；意图：上下键在首尾连续导航；调用时机：菜单方向键事件。 */
const moveSuggestionSelection = (state: SuggestionMenuState, direction: -1 | 1) => {
    // 没有候选时保持下标为零，不执行取模运算。
    if (state.items.length === 0) {
        return;
    }
    state.selectedIndex = (state.selectedIndex + direction + state.items.length) % state.items.length;
    updateSuggestionHighlight(state);
};

/**
 * 作用：执行当前候选命令并关闭菜单；意图：点击和键盘确认共享同一状态转换；
 * 调用时机：Enter 键；问题/改进：命令先执行，编辑器更新也可主动关闭菜单。
 */
const confirmSuggestionSelection = (state: SuggestionMenuState) => {
    const item = state.items[state.selectedIndex];
    const command = state.command;
    // 状态已被其他菜单关闭或当前下标失效时不执行过期命令。
    if (!item || !command) {
        return;
    }
    command(item);
    closeTiptapSuggestionMenu(state);
};

/** @同步豁免: 生命周期 Tiptap keydown 要求在同一事件分派中返回是否消费按键，异步返回不符合第三方协议。 */
/** 统一处理 @ 与 / 菜单的方向键、确认和退出，返回是否消费了按键。 */
export const handleTiptapSuggestionMenuKey = (state: SuggestionMenuState, event: KeyboardEvent) => {
    // 未打开菜单时把按键完整交还给 Tiptap 编辑器。
    if (!state.open) {
        return false;
    }
    // 方向键只移动当前候选，不改变编辑器选择。
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveSuggestionSelection(state, event.key === "ArrowDown" ? 1 : -1);
        return true;
    }
    // Enter 执行当前候选命令并消费发送按键。
    if (event.key === "Enter") {
        event.preventDefault();
        confirmSuggestionSelection(state);
        return true;
    }
    // Escape 只退出建议菜单，不修改编辑器内容。
    if (event.key === "Escape") {
        event.preventDefault();
        closeTiptapSuggestionMenu(state);
        return true;
    }
    return false;
};
