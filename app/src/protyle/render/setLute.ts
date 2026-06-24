/**
 * setLute.ts - Lute 实例工厂
 *
 * Lute 配置全部读取全局 window.siyuan.config / window.siyuan.emojis，跨编辑器一致，
 * 因此所有 Protyle 编辑器共用同一个 Lute 实例，将内存与初始化开销从 O(编辑器数) 降为 O(1)。
 * AgentChat 维持自身的独立 Lute.New() 实例，不经过此处。
 */

/** 用途：封装 window.siyuan.config.editor / markdown / emojis 访问。使用范围：仅在 setLute 函数链中读取全局配置。解耦评估：同目录环境层文件，是当前架构约定下的直接依赖。 */
import { getEditorConfig } from "./setLute.environment";
/** 用途：封装 editor.markdown 配置访问。使用范围：applyMarkdownOptions 函数。解耦评估：同目录环境层文件。 */
import { getEditorMarkdownConfig } from "./setLute.environment";
/** 用途：封装 window.siyuan.emojis 访问。使用范围：applyEmojiOptions 函数。解耦评估：同目录环境层文件。 */
import { getEmojisList } from "./setLute.environment";

let luteInstance: Lute | undefined;

/**
 * 获取（首次调用时创建）共享 Lute 单例。
 *
 * 仅在首次创建时应用 options，后续调用直接返回已缓存的实例 ——
 * Lute 配置本就源于全局 config，跨编辑器一致，无需按编辑器区分。
 */
/** @同步豁免: 遗留代码 - Lute 实例化是同步的 C 扩展调用，初始化后即缓存 */
export const getLute = (options: ILuteOptions) => {
    if (!luteInstance) {
        luteInstance = setLute(options);
    }
    return luteInstance;
};

/**
 * 直接获取已初始化的共享 Lute 单例。
 * 供 emoji 等无需传入 options 的场景使用；尚未创建时返回 undefined。
 */
/** @同步豁免: 遗留代码 - 返回已缓存实例的同步 getter，无异步需求 */
export const getLuteInstance = () => {
    return luteInstance;
};

/**
 * 根据全局配置与传入选项构建一个新的 Lute 实例，供共享单例初始化使用。
 * AgentChat 通过此函数创建独立 Lute 实例以处理 AI 响应中的 Markdown 到 DOM 转换。
 */
/** @同步豁免: 遗留代码 - Lute.New() 是同步的 C 扩展调用，无法异步化 */
export const setLute = (options: ILuteOptions) => {
    const lute: Lute = Lute.New();
    applyBaseOptions(lute);
    applyMarkdownOptions(lute);
    applyEmojiOptions(lute, options);
    lute.SetParagraphBeginningSpace(true);
    lute.SetSetext(false);
    lute.SetFootnotes(false);
    lute.SetLinkRef(false);
    lute.SetSanitize(options.sanitize ?? true);
    lute.SetChineseParagraphBeginningSpace(options.paragraphBeginningSpace ?? false);
    lute.SetRenderListStyle(options.listStyle ?? false);
    lute.SetImgPathAllowSpace(true);
    lute.SetKramdownIAL(true);
    lute.SetTag(true);
    lute.SetSuperBlock(true);
    lute.SetCallout(true);
    lute.SetUnorderedListMarker("-");
    lute.SetDataTask(true);
    lute.SetExportNormalizeTaskListMarker(true);
    lute.SetArbitraryTaskListItemMarker(true);
    lute.SetEnsureListItemParagraph(true); // 空列表项下创建子列表前补一个空段落
    return lute;
};

/**
 * 配置 Lute 的基础选项（编辑器配置相关）。
 *
 * 读取全局 editor 配置并应用到 Lute 实例。
 */
/** @同步豁免: 遗留代码 - Lute 配置链是同步的 C 扩展调用 */
/** @显式返回类型原因: 显式标注 void 明确该函数无返回值，禁止调用方意外使用其结果。 */
function applyBaseOptions(lute: Lute) {
    const editorConfig = getEditorConfig();
    const markdownConfig = getEditorMarkdownConfig();
    if (!editorConfig || !markdownConfig) {
        return;
    }
    lute.SetSpellcheck(editorConfig.spellcheck);
    lute.SetProtyleMarkNetImg(editorConfig.displayNetImgMark);
    lute.SetFileAnnotationRef(true);
    lute.SetHTMLTag2TextMark(true);
    lute.SetTextMark(true);
    lute.SetHeadingID(false);
    lute.SetYamlFrontMatter(false);
    lute.SetHeadingAnchor(false);
    lute.SetInlineMathAllowDigitAfterOpenMarker(true);
    lute.SetToC(false);
    lute.SetIndentCodeBlock(false);
    lute.SetGFMStrikethrough1(false);
    lute.SetBlockRef(true);
    lute.SetSpin(true);
    lute.SetProtyleWYSIWYG(true);
}

/**
 * 配置 Lute 的行内 Markdown 选项。
 *
 * 读取全局 editor.markdown 配置并应用到 Lute 实例。
 */
/** @同步豁免: 遗留代码 - Lute 配置链是同步的 C 扩展调用 */
/** @显式返回类型原因: 显式标注 void 明确该函数无返回值，禁止调用方意外使用其结果。 */
function applyMarkdownOptions(lute: Lute) {
    const markdownConfig = getEditorMarkdownConfig();
    if (!markdownConfig) {
        return;
    }
    lute.SetInlineAsterisk(markdownConfig.inlineAsterisk);
    lute.SetInlineUnderscore(markdownConfig.inlineUnderscore);
    lute.SetSup(markdownConfig.inlineSup);
    lute.SetSub(markdownConfig.inlineSub);
    lute.SetTag(markdownConfig.inlineTag);
    lute.SetInlineMath(markdownConfig.inlineMath);
    lute.SetGFMStrikethrough(markdownConfig.inlineStrikethrough);
    lute.SetMark(markdownConfig.inlineMark);
    if (markdownConfig.inlineStrikethrough) {
        lute.SetGFMStrikethrough1(false);
    }
}

/**
 * 配置 Lute 的表情选项。
 *
 * 读取全局 emojis 列表并在运行时将 dynamic loading 的选项也一并应用，
 * 使表情名称到图标 URL 的映射在 Lute 内部完整生效。
 */
/** @同步豁免: 遗留代码 - Lute 配置链是同步的 C 扩展调用 */
/** @显式返回类型原因: 显式标注 void 明确该函数无返回值，禁止调用方意外使用其结果。 */
function applyEmojiOptions(lute: Lute, options: ILuteOptions) {
    lute.PutEmojis(options.emojis);
    lute.SetEmojiSite(options.emojiSite);

    // 从全局已加载的第一组表情包构建名→URL映射，
    // 使自定义表情在 Markdown 解析时能被正确替换为图标链接
    const emojisList = getEmojisList();
    const firstEmojiGroup = emojisList?.[0];
    // 仅在至少存在一个已注册的表情包时构建完整映射，避免空遍历
    if (firstEmojiGroup?.items?.length) {
        const emojis: IObject = {};
        for (const item of firstEmojiGroup.items) {
            emojis[item.keywords] = options.emojiSite + "/" + item.unicode;
        }
        lute.PutEmojis(emojis);
    }

    // 图片懒加载仅在明确指定时才覆盖默认行为
    if (options.lazyLoadImage) {
        lute.SetImageLazyLoading(options.lazyLoadImage);
    }
}
