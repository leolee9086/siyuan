/** 用途：映射块图标；使用范围：Composer 的 @ 引用建议；解耦评估：纯展示映射通过目录网关复用。 */
import {getIconByType} from "./imports";
/** 用途：创建 Tiptap Mention 扩展；使用范围：Composer 的 @ 引用建议；解耦评估：扩展配置使用 Tiptap 公开协议并显式接收菜单状态。 */
import {Mention} from "./imports";
/** 用途：校验 Tiptap 未约束的 Mention 选择值；使用范围：引用插入命令；解耦评估：运行时边界必须验证外部扩展数据。 */
import {isBlockHit} from "./blockHit.guard";
/** 用途：关闭统一标准菜单；使用范围：Mention 退出回调；解耦评估：通过显式状态参数协作，不持有隐藏 DOM。 */
import {closeTiptapSuggestionMenu} from "./menu";
/** 用途：处理统一标准菜单键盘动作；使用范围：Mention 键盘回调；解耦评估：复用同一 @ 与 / 选择协议。 */
import {handleTiptapSuggestionMenuKey} from "./menu";
/** 用途：打开统一标准菜单；使用范围：Mention 启动和更新回调；解耦评估：统一定位和关闭生命周期由 Menu 负责。 */
import {openTiptapSuggestionMenu} from "./menu";
/** 用途：约束可观察菜单状态；使用范围：Mention 扩展工厂。 */
import type {SuggestionMenuState} from "./types";

/**
 * 作用：把内核块搜索结果映射为统一菜单条目；意图：过滤 HTML 标记并集中图标规则；
 * 调用时机：引用查询返回后；问题/改进：标题仍保持既有 80 字符上限。
 */
const toBlockHit = (block: Record<string, unknown>) => {
    const id = String(block.id || "");
    const raw = String(block.content || block.refText || block.name || id);
    const plain = Lute.UnEscapeHTMLStr(raw.replace(/<[^>]+>/g, "")).trim() || id;
    return {
        id,
        label: plain.slice(0, 80),
        icon: getIconByType(String(block.type || "NodeParagraph"), block.subType ? String(block.subType) : ""),
        hPath: Lute.UnEscapeHTMLStr(String(block.hPath || "")),
    };
};

/** 查询内核块引用并只返回菜单需要的领域字段。 */
export const searchComposerReferenceBlocks = async (query: string) => {
    try {
        const response = await fetch("/api/search/searchRefBlock", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({k: query, id: "", rootID: "", beforeLen: 48, isDatabase: false, isSquareBrackets: true}),
        });
        const payload: {data?: {blocks?: Array<Record<string, unknown>>}} = await response.json();
        return (payload.data?.blocks ?? []).slice(0, 10).map(toBlockHit);
    } catch {
        return [];
    }
};

// @柯里化：Mention 的全部第三方回调必须捕获同一个实例级菜单状态。
/** @同步豁免: UI构建 Tiptap 构造时必须同步获得 Mention 扩展，异步化不符合扩展协议。 */
/** 创建只负责 @ 引用节点与建议协议的 Mention 扩展。 */
export const createAgentComposerMentionExtension = (state: SuggestionMenuState) =>
    Mention.configure({
        HTMLAttributes: {class: "agent-mention-chip"},
        /** 将 Mention 节点序列化为用户可读的 @ 标题；编辑器读取文本时调用。 */
        renderText: ({node}) => `@${node.attrs.label || node.attrs.id || ""}`,
        suggestion: {
            char: "@",
            allowToIncludeChar: true,
            allowedPrefixes: null,
            /** 将 Tiptap 当前查询转发给块搜索；每次建议查询变化时调用。 */
            items: ({query}) => searchComposerReferenceBlocks(query),
            /** 验证并插入用户选中的块引用；点击或 Enter 确认时调用。 */
            command: ({editor, range, props}) => {
                // Tiptap Mention 的默认泛型为 unknown，边界校验失败时不写入文档。
                if (!isBlockHit(props)) {
                    return;
                }
                editor.chain().focus().insertContentAt(range, [
                    {type: "mention", attrs: {id: props.id, label: props.label}},
                    {type: "text", text: " "},
                ]).run();
            },
            /** 建立 Mention 建议生命周期回调；Tiptap 初始化建议渲染器时调用。 */
            render: () => ({
                /** 首次出现 @ 查询时用标准 Menu 展示结果。 */
                onStart: (props) => openTiptapSuggestionMenu({
                    state,
                    items: props.items,
                    command: props.command,
                    clientRect: props.clientRect ?? undefined,
                }),
                /** 查询词或结果变化时原位替换标准 Menu 内容。 */
                onUpdate: (props) => openTiptapSuggestionMenu({
                    state,
                    items: props.items,
                    command: props.command,
                    clientRect: props.clientRect ?? undefined,
                }),
                /** Mention 建议退出时只关闭当前 Composer 拥有的菜单。 */
                onExit: () => closeTiptapSuggestionMenu(state),
                /** 建议激活时把方向键、确认和退出交给统一菜单处理器。 */
                onKeyDown: (props) => handleTiptapSuggestionMenuKey(state, props.event),
            }),
        },
    });
