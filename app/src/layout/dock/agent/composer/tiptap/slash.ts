/** 用途：约束 Tiptap 编辑器实例；使用范围：Slash 查询、替换和光标定位。 */
import type {Editor} from "./imports";
/** 用途：关闭项目标准建议菜单；使用范围：Slash 退出和销毁；解耦评估：菜单状态由调用者显式传入，不在模块级保存。 */
import {closeTiptapSuggestionMenu} from "./menu";
/** 用途：打开项目标准建议菜单；使用范围：Slash 技能请求完成；解耦评估：复用统一菜单定位和生命周期。 */
import {openTiptapSuggestionMenu} from "./menu";
/** 用途：约束技能条目；使用范围：Slash 请求、过滤与选择回调。 */
import type {BlockHit} from "./types";
/** 用途：约束 Composer 聚合状态；使用范围：Slash 请求与生命周期。 */
import type {TiptapComposerInteractionState} from "./types";
/** 用途：约束已解析 Slash 快照；使用范围：匹配、请求和菜单定位。 */
import type {SlashMatch} from "./types";

/**
 * 作用：解析当前光标所在段落末尾的 Slash 查询；意图：把文本匹配、替换区间和定位信息一次快照；
 * 调用时机：每次 Tiptap update；问题/改进：只匹配行首或空白后的 Slash，避免普通路径文本误触发。
 */
const readSlashMatch = (editor: Editor) => {
    const {$from} = editor.state.selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset);
    const match = textBefore.match(/(?:^|\s)\/(\S*)$/);
    // 当前选择不再位于 Slash 查询末尾时，由上层结束已激活状态。
    if (!match) {
        return null;
    }
    const query = match[1];
    const coords = editor.view.coordsAtPos($from.pos);
    return {
        query,
        range: {from: $from.pos - query.length - 1, to: $from.pos},
        /** 将 Tiptap 光标坐标转换为标准 Menu 使用的 DOMRect 锚点。 */
        clientRect: () => DOMRect.fromRect({
            x: coords.left,
            y: coords.top,
            width: coords.right - coords.left,
            height: coords.bottom - coords.top,
        }),
    };
};

/** 作用：把 Agent 技能响应映射为统一菜单条目；意图：接口字段不泄漏到菜单；调用时机：技能列表返回后。 */
const toSkillHit = (skill: Record<string, unknown>) => ({
    id: String(skill.name || ""),
    label: String(skill.name || ""),
    icon: "",
    hPath: String(skill.description || ""),
});

/**
 * 作用：从 Agent API 读取当前技能并映射为统一建议条目；意图：菜单不理解接口原始字段；
 * 调用时机：每次有效 Slash 查询；问题/改进：请求版本由调用方判定，旧结果不会写入菜单。
 */
const loadSkillHits = async () => {
    const response = await fetch("/api/ai/agent/lsSkills", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
    });
    const payload: {data?: Array<Record<string, unknown>>} = await response.json();
    return (payload.data ?? []).map(toSkillHit);
};

/** 作用：按名称或描述过滤技能；意图：保持查询规则集中；调用时机：请求返回且版本仍有效。 */
const filterSkillHits = (items: BlockHit[], query: string) => {
    const normalized = query.toLowerCase();
    return normalized ? items.filter((item) =>
        item.label.toLowerCase().includes(normalized) || item.hPath.toLowerCase().includes(normalized)) : items;
};

/** @同步豁免: 生命周期 Slash 退出必须在当前按键或内容更新事件内使请求版本失效。 */
/** 结束当前 Slash 状态并使尚未返回的请求失效。 */
export const deactivateTiptapSlashSuggestions = (state: TiptapComposerInteractionState) => {
    state.slash.requestRevision++;
    state.slash.active = false;
    state.slash.range = null;
    closeTiptapSuggestionMenu(state.suggestion);
};

/**
 * 作用：用选中技能替换 Slash 查询区间；意图：先使旧请求失效再触发编辑器更新；
 * 调用时机：菜单点击或 Enter 确认；问题/改进：失效区间会被守卫忽略。
 */
const insertSelectedSkill = (
    editor: Editor,
    state: TiptapComposerInteractionState,
    item: BlockHit,
) => {
    const range = state.slash.range;
    // 菜单已退出或区间被新输入清理时，不再修改编辑器内容。
    if (!range) {
        return;
    }
    deactivateTiptapSlashSuggestions(state);
    editor.chain().focus().deleteRange(range).insertContent(`${item.label} `).run();
};

/** 作用：核对异步响应版本；意图：阻止失焦、销毁和旧请求覆盖当前菜单；调用时机：请求完成或失败。 */
const isCurrentSlashRequest = (
    state: TiptapComposerInteractionState,
    revision: number,
 ) => !state.destroyed && state.slash.active && state.slash.requestRevision === revision;

/**
 * 作用：发起一次带版本快照的技能查询；意图：异步完成后只提交仍然有效的结果；
 * 调用时机：解析到有效 Slash 文本后；问题/改进：网络错误只结束当前版本，不伪造空成功。
 */
const requestSlashSuggestions = async (
    editor: Editor,
    state: TiptapComposerInteractionState,
    match: SlashMatch,
 ) => {
    const revision = ++state.slash.requestRevision;
    try {
        const items = await loadSkillHits();
        // 用户继续输入、失焦或销毁后，旧响应直接丢弃。
        if (!isCurrentSlashRequest(state, revision)) {
            return;
        }
        openTiptapSuggestionMenu({
            state: state.suggestion,
            items: filterSkillHits(items, match.query),
            /** 点击或 Enter 确认时使用当前有效替换区间插入技能名。 */
            command: (item) => insertSelectedSkill(editor, state, item),
            clientRect: match.clientRect,
        });
    } catch {
        // 只有仍对应当前查询的失败才关闭菜单，新查询不受旧失败影响。
        if (isCurrentSlashRequest(state, revision)) {
            deactivateTiptapSlashSuggestions(state);
        }
    }
};

/** @同步豁免: 生命周期 Tiptap update 回调必须同步快照选择和递增请求版本，再异步读取技能。 */
/** 根据当前光标前文本确定性地更新 Slash 技能建议，旧异步结果不得覆盖新状态。 */
export const updateTiptapSlashSuggestions = (
    editor: Editor,
    state: TiptapComposerInteractionState,
) => {
    // 销毁后的实例或正由 Mention 占用的菜单不参与 Slash 更新。
    if (state.destroyed || (state.suggestion.open && !state.slash.active)) {
        return;
    }
    const match = readSlashMatch(editor);
    // 已激活的 Slash 在文本不再匹配时同步关闭并使请求失效。
    if (!match && state.slash.active) {
        deactivateTiptapSlashSuggestions(state);
        return;
    }
    // 从未激活且没有匹配时不产生任何菜单状态变化。
    if (!match) {
        return;
    }
    state.slash.active = true;
    state.slash.range = match.range;
    void requestSlashSuggestions(editor, state, match);
};

/** @同步豁免: 生命周期 blur 必须在当前焦点事件内使请求版本失效，异步处理会允许迟到响应重新打开菜单。 */
/** 在焦点离开 Composer 和其标准菜单时结束 Slash 状态；菜单内部焦点迁移继续保留选择。 */
export const handleTiptapSlashBlur = (state: TiptapComposerInteractionState, event: FocusEvent) => {
    // 非 Slash 场景由 Mention 自己的 onExit 管理，不能误关其标准菜单。
    if (!state.slash.active) {
        return;
    }
    const nextTarget = event.relatedTarget;
    // 从编辑器移到当前标准菜单按钮时保留状态，让后续 click 执行选择命令。
    if (nextTarget instanceof Element && state.suggestion.menu.element.contains(nextTarget)) {
        return;
    }
    deactivateTiptapSlashSuggestions(state);
};

/** @同步豁免: 生命周期 销毁必须同步标记状态并关闭菜单，避免完成后的异步请求写回 DOM。 */
/** 销毁交互状态并阻止已发出的异步技能请求重新打开菜单。 */
export const destroyTiptapComposerInteraction = (state: TiptapComposerInteractionState) => {
    state.destroyed = true;
    deactivateTiptapSlashSuggestions(state);
};
