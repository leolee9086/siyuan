import { z } from 'zod'

export const schema = z.object({
    alias: z.boolean(),
    audioBlock: z.boolean(),
    backlinkMentionAlias: z.boolean(),
    backlinkMentionAnchor: z.boolean(),
    backlinkMentionDoc: z.boolean(),
    backlinkMentionKeywordsLimit: z.number(),
    backlinkMentionName: z.boolean(),
    blockquote: z.boolean(),
    caseSensitive: z.boolean(),
    codeBlock: z.boolean(),
    databaseBlock: z.boolean(),
    document: z.boolean(),
    embedBlock: z.boolean(),
    heading: z.boolean(),
    htmlBlock: z.boolean(),
    iframeBlock: z.boolean(),
    ial: z.boolean(),
    indexAssetPath: z.boolean(),
    limit: z.number(),
    list: z.boolean(),
    listItem: z.boolean(),
    mathBlock: z.boolean(),
    memo: z.boolean(),
    name: z.boolean(),
    paragraph: z.boolean(),
    superBlock: z.boolean(),
    table: z.boolean(),
    videoBlock: z.boolean(),
    virtualRefAlias: z.boolean(),
    virtualRefAnchor: z.boolean(),
    virtualRefDoc: z.boolean(),
    virtualRefName: z.boolean(),
    widgetBlock: z.boolean()
})


export const parseAsSearchConfig = (rawConf: {}): Config.IConf['search'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`搜索配置解析失败: ${result.error.message}`);
    }

    return result.data;
}