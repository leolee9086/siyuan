/** 用途：格式化消息日期时间；使用范围：本文件消息时间展示函数。 */
import {dayjs} from "./imports";
/** 用途：约束确认效果数据；使用范围：确认效果列表。 */
import type {IToolEffects} from "./imports";
/** 用途：转义确认效果文案；使用范围：确认效果列表。 */
import {escapeHtml} from "./imports";

/** 渲染需要在确认卡片中提示的副作用。 @同步豁免: UI构建 */
export function renderConfirmEffects(effects?: IToolEffects) {
    if (!effects) {
        return "";
    }
    const languages = window.siyuan.languages;
    const items: string[] = [];
    if (effects.dataEgress) {
        items.push(languages.agentEffectDataEgress);
    }
    if (effects.externalCost) {
        items.push(languages.agentEffectExternalCost);
    }
    if (effects.localWrite) {
        items.push(languages.agentEffectLocalWrite);
    }
    if (items.length === 0) {
        return "";
    }
    return '<ul class="agent-chat__confirm-effects">' +
        items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") + "</ul>";
}

/**
 * 返回工具所属的本地化类别。
 * @同步豁免: 工具卡片 HTML 构建需要立即获得本地化类别字符串，纯查表过程没有异步工作。
 */
export function toolCategory(name: string) {
    const languages = window.siyuan.languages;
    const categories: Record<string, string | undefined> = {
        "block": languages.agentCatBlock,
        "document": languages.agentCatDoc,
        "notebook": languages.agentCatNotebook,
        "tag": languages.agentCatTag,
        "bookmark": languages.agentCatBookmark,
        "file": languages.agentCatFile,
        "asset": languages.agentCatAsset,
        "attr": languages.agentCatAttr,
        "dailynote": languages.agentCatDailynote,
        "import": languages.agentCatImport,
        "repo": languages.agentCatRepo,
        "history": languages.agentCatHistory,
        "sync": languages.agentCatSync,
        "database": languages.agentCatDatabase,
    };
    return categories[name] || languages.agentCatDefault;
}

/**
 * 将消息时间格式化为当天时间或完整日期时间。
 * @同步豁免: 消息元素构建时需要立即获得展示文本，时间格式化是纯计算。
 */
export function formatMessageTime(timestamp: number) {
    const date = dayjs(timestamp);
    // 当天消息只展示时间，历史消息同时展示日期。
    if (date.format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD")) {
        return date.format("HH:mm");
    }
    return date.format("YYYY-MM-DD HH:mm");
}
