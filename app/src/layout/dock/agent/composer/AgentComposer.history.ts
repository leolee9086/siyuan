/** 用途：约束公开的 Composer 历史状态；使用范围：所有历史状态转换。 */
import type {ComposerHistoryState} from "./AgentComposer.history.types";

/** @同步豁免: UI构建 Composer 挂载必须同步获得独立历史状态，异步化会破坏现有挂载句柄契约。 */
/** @显式返回类型原因: 空数组和数值初值需要扩宽为可变 ComposerHistoryState。 */
export const createComposerHistory = (): ComposerHistoryState => ({items: [], index: -1, savedDraft: ""});

/** @同步豁免: 生命周期 发送完成时必须同步记录历史，下一次键盘事件需要立即观察结果。 */
/** 记录去重后的非空发送文本，并只保留最近五十条。 */
export const pushComposerHistory = (state: ComposerHistoryState, text: string) => {
    // 空文本和相邻重复项不产生新的历史状态。
    if (!text || state.items[state.items.length - 1] === text) {
        return;
    }
    state.items.push(text);
    // 历史容量固定为五十，超出后丢弃最旧条目。
    if (state.items.length > 50) {
        state.items.shift();
    }
    state.index = -1;
    state.savedDraft = "";
};

/** @同步豁免: 生命周期 会话清理必须立即重置条目、浏览位置和暂存草稿。 */
/** 清空完整历史状态。 */
export const clearComposerHistory = (state: ComposerHistoryState) => {
    state.items = [];
    state.index = -1;
    state.savedDraft = "";
};

/** @同步豁免: 生命周期 会话切换必须在恢复编辑器内容前同步恢复对应历史。 */
/** 从持久化快照恢复最近五十条历史并退出浏览状态。 */
export const restoreComposerHistory = (state: ComposerHistoryState, items: string[]) => {
    state.items = items.slice(-50);
    state.index = -1;
    state.savedDraft = "";
};

/** @同步豁免: 性能考虑 keydown 热路径需要立即判定是否存在历史，创建 Promise 没有领域收益。 */
/** 判断历史是否包含可浏览条目。 */
export const hasComposerHistory = (state: ComposerHistoryState) => state.items.length > 0;

/** @同步豁免: 性能考虑 keydown 热路径需要立即判定浏览状态，创建 Promise 不符合事件协议。 */
/** 判断当前是否正在浏览历史。 */
export const isBrowsingComposerHistory = (state: ComposerHistoryState) => state.index !== -1;

/** @同步豁免: 生命周期 用户开始编辑或设置内容时必须立即退出历史浏览。 */
/** 退出历史浏览并丢弃暂存草稿。 */
export const resetComposerHistoryCursor = (state: ComposerHistoryState) => {
    state.index = -1;
    state.savedDraft = "";
};

/** @同步豁免: 生命周期 ArrowUp 事件必须在当前分派中保存草稿并返回最新历史。 */
/** 从当前草稿进入历史浏览并返回最新条目。 */
export const beginComposerHistoryBrowsing = (state: ComposerHistoryState, currentDraft: string) => {
    state.savedDraft = currentDraft;
    state.index = state.items.length - 1;
    return state.items[state.index] ?? "";
};

/** @同步豁免: 生命周期 ArrowUp 事件必须同步更新浏览位置并返回目标文本。 */
/** 向较旧历史移动，抵达首项后保持不变。 */
export const navigateComposerHistoryUp = (state: ComposerHistoryState) => {
    // 仍有更旧条目时才递减，避免负下标。
    if (state.index > 0) {
        state.index--;
    }
    return state.items[state.index] ?? "";
};

/** @同步豁免: 生命周期 ArrowDown 事件必须同步更新浏览位置并恢复进入前草稿。 */
/** 向较新历史移动，越过末项时退出浏览并返回暂存草稿。 */
export const navigateComposerHistoryDown = (state: ComposerHistoryState) => {
    state.index++;
    // 越过最新历史时恢复原草稿，并完整重置浏览状态。
    if (state.index >= state.items.length) {
        const draft = state.savedDraft;
        resetComposerHistoryCursor(state);
        return draft;
    }
    return state.items[state.index] ?? "";
};
