/** 用途：转义技能菜单文本；使用范围：Protyle 原生 Hint 结果渲染；解耦评估：纯字符串能力经目录网关复用。 */
import {escapeHtml} from "./imports";
/** 用途：读取 Agent 技能；使用范围：Protyle 原生 Slash Hint；解耦评估：沿用项目统一网络入口和 Hint 回调协议。 */
import {fetchPost} from "./imports";
/** 用途：复用 Protyle 块引用菜单；使用范围：四种引用前缀；解耦评估：Hint 属于 Protyle 宿主原生菜单生命周期。 */
import {hintRef} from "./imports";
/** 用途：判断迟到的技能响应是否仍对应可见输入状态；使用范围：异步响应竞态防护。 */
import {isSkillHintRequestActive} from "./imports";
/** 用途：判断 Slash 查询是否仍在拼接引用前缀；使用范围：技能与引用菜单让位协议。 */
import {shouldYieldSkillHint} from "./imports";
/** 用途：约束可观察建议请求状态；使用范围：异步响应版本校验。 */
import type {AgentProtyleComposerRuntime} from "./types";

/** Hint 面板处于隐藏态时提升层级，避免浮动 Dock 内的菜单被宿主变换坐标系裁剪或压盖。 */
const prepareAgentHint = (protyle: IProtyle) => {
    if (protyle.hint.element.classList.contains("fn__none")) {
        protyle.hint.element.style.zIndex = (++window.siyuan.zIndex).toString();
    }
};

/** 把接口技能记录规范化为 Protyle Hint 条目，缺少名称的记录不进入菜单。 */
const toSkillHint = (skill: Record<string, unknown>) => {
    const name = typeof skill.name === "string" ? skill.name : "";
    // 没有稳定名称的技能无法形成可提交值，直接忽略该记录。
    if (!name) {
        return null;
    }
    const description = typeof skill.description === "string" ? skill.description : "";
    const descriptionHTML = description
        ? '<div class="b3-list-item__meta b3-list-item__showall">' + escapeHtml(description) + "</div>"
        : "";
    return {
        value: `${name} `,
        html: '<div class="b3-list-item__first"><span class="b3-list-item__text">' +
            escapeHtml(name) + "</span></div>" + descriptionHTML,
    };
};

/** 判断一个技能是否与当前 Slash 查询匹配。 */
const matchesSkillQuery = (skill: Record<string, unknown>, query: string) => {
    if (!query) {
        return true;
    }
    const name = typeof skill.name === "string" ? skill.name.toLowerCase() : "";
    const description = typeof skill.description === "string" ? skill.description.toLowerCase() : "";
    return name.includes(query) || description.includes(query);
};

/** 将仍有效的技能响应提交给当前 Protyle Hint；销毁、失焦和旧请求响应均被丢弃。 */
const applySkillHintResponse = (
    state: AgentProtyleComposerRuntime["suggestion"],
    protyle: IProtyle,
    request: {query: string; revision: number; response: IWebSocketData},
) => {
    const hint = protyle.hint;
    // Hint 已释放、Composer 已销毁或响应版本过期时，不再写回菜单 DOM。
    if (!hint || state.destroyed || request.revision !== state.requestRevision) {
        return;
    }
    // 上游竞态协议：Esc、其它提示触发或面板已脱离文档时，迟到的技能响应必须丢弃。
    if (!isSkillHintRequestActive({
        requestID: request.revision,
        currentRequestID: state.requestRevision,
        enableExtend: hint.enableExtend,
        enableSlash: hint.enableSlash,
        splitChar: hint.splitChar,
        hidden: hint.element.classList.contains("fn__none"),
        connected: hint.element.isConnected,
    })) {
        return;
    }
    const rawSkills: unknown[] = Array.isArray(request.response.data) ? request.response.data : [];
    const dataList: IHintData[] = [];
    for (const rawSkill of rawSkills) {
        // API 非对象条目不具备名称和描述字段，忽略后继续处理其余技能。
        if (!rawSkill || typeof rawSkill !== "object") {
            continue;
        }
        const skill: Record<string, unknown> = Object(rawSkill);
        if (!matchesSkillQuery(skill, request.query)) {
            continue;
        }
        const hintItem = toSkillHint(skill);
        if (hintItem) {
            dataList.push(hintItem);
        }
    }
    // 没有匹配技能时仍使用 Protyle 标准空条目，保持 Hint 键盘协议稳定。
    if (dataList.length === 0) {
        dataList.push({value: "", html: window.siyuan.languages.emptyContent});
    }
    hint.genHTML(dataList, protyle, false, "hint");
};

/** 发起一次带版本快照的技能查询，并立即返回 Protyle Hint 所需的占位数组。 */
const requestSkillHints = (
    state: AgentProtyleComposerRuntime["suggestion"],
    key: string,
    protyle: IProtyle,
) => {
    const hint = protyle.hint;
    // 半初始化或已销毁的 Hint 不再创建请求。
    if (!hint || state.destroyed) {
        return [];
    }
    // 上游让位协议：输入仍在拼接多字符引用前缀时交给引用菜单，避免 "/" 与 "((" 竞争。
    if (shouldYieldSkillHint(key, protyle.options.hint.extend.map((item) => item.key))) {
        hint.enableExtend = false;
        hint.genHTML([], protyle, true, "hint");
        return [];
    }
    // 隐藏面板首次弹出前修正层级，技能与引用菜单共享同一协议。
    prepareAgentHint(protyle);
    hint.genLoading(protyle);
    const revision = ++state.requestRevision;
    const query = key.toLowerCase();
    void fetchPost("/api/ai/agent/lsSkills", {},
        /** 网络完成后只把当前版本响应交给原生 Hint。 */
        (response) => applySkillHintResponse(state, protyle, {query, revision, response}));
    return [];
};

/** 把一个引用前缀映射为 Protyle 原生块引用 Hint，并在面板弹出前按需修正层级。 */
const toReferenceHint = (key: string) => ({
    key,
    /** 引用菜单与技能菜单共享同一层级修正协议（上游浮动 Dock 修复）。 */
    hint: (...args: Parameters<typeof hintRef>) => {
        prepareAgentHint(args[1]);
        return hintRef(...args);
    },
});

/** 创建固定的四种块引用前缀配置；每次编辑器初始化获得独立数组。 */
const createReferenceHints = () => {
    const hints: Array<{key: string; hint: typeof hintRef}> = [];
    hints.push(toReferenceHint("(("));
    hints.push(toReferenceHint("【【"));
    hints.push(toReferenceHint("（（"));
    hints.push(toReferenceHint("[["));
    return hints;
};

/** @同步豁免: UI构建 Protyle 初始化要求同步取得 Hint 配置，异步化会改变编辑器构造协议。 */
/** 创建仅使用 Protyle 原生 Hint 的引用与技能菜单配置。 */
export const createAgentProtyleHintOptions = (state: AgentProtyleComposerRuntime["suggestion"]) => {
    const referenceHints = createReferenceHints();
    return {extend: [...referenceHints, {
        key: "/",
        /** Slash 输入由显式请求状态驱动，结果仍渲染到当前 Protyle Hint。 */
        hint: (key: string, protyle: IProtyle) => requestSkillHints(state, key, protyle),
    }, {
        key: "、",
        /** 中文顿号入口复用同一技能请求与 Hint 生命周期。 */
        hint: (key: string, protyle: IProtyle) => requestSkillHints(state, key, protyle),
    }]};
};
