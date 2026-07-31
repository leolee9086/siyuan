import z from "zod";
export const schema = z.object({
    allowHTMLBLockScript: z.boolean(),
    markdown: z.object({
        inlineAsterisk: z.boolean(),
        inlineUnderscore: z.boolean(),
        inlineSup: z.boolean(),
        inlineSub: z.boolean(),
        inlineTag: z.boolean(),
        inlineMath: z.boolean(),
        inlineStrikethrough: z.boolean(),
        inlineMark: z.boolean()
    }),
    backlinkExpandCount: z.number(),
    backmentionExpandCount: z.number(),
    backlinkContainChildren: z.boolean(),
    backlinkShowBottom: z.boolean(),
    backlinkSort: z.number(),
    backmentionSort: z.number(),
    blockRefDynamicAnchorTextMaxLen: z.number(),
    codeLigatures: z.boolean(),
    codeLineWrap: z.boolean(),
    codeSyntaxHighlightLineNum: z.boolean(),
    codeTabSpaces: z.number(),
    displayBookmarkIcon: z.boolean(),
    displayNetImgMark: z.boolean(),
    dynamicLoadBlocks: z.number(),
    embedBlockBreadcrumb: z.boolean(),
    headingEmbedMode: z.number(),
    emoji: z.array(z.string()),
    floatWindowMode: z.number(),
    fontFamily: z.string(),
    fontSize: z.number(),
    fontSizeScrollZoom: z.boolean(),
    fullWidth: z.boolean(),
    generateHistoryInterval: z.number(),
    historyRetentionDays: z.number(),
    justify: z.boolean(),
    katexMacros: z.string(),
    listItemDotNumberClickFocus: z.boolean(),
    listLogicalOutdent: z.boolean(),
    onlySearchForDoc: z.boolean(),
    plantUMLServePath: z.string(),
    readOnly: z.boolean(),
    rtl: z.boolean(),
    spellcheck: z.boolean(),
    virtualBlockRef: z.boolean(),
    spellcheckLanguages: z.array(z.string()),
    virtualBlockRefExclude: z.string(),
    virtualBlockRefInclude: z.string()
});

const parseAsConfig = (rawConf: object): Config.IConf["editor"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
};
