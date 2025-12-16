import z from "zod";

const graphNodeSchema = z.object({
    blockquote: z.boolean(),
    code: z.boolean(),
    heading: z.boolean(),
    list: z.boolean(),
    listItem: z.boolean(),
    math: z.boolean(),
    paragraph: z.boolean(),
    super: z.boolean(),
    table: z.boolean(),
    tag: z.boolean()
});

const graphD3Schema = z.object({
    arrow: z.boolean(),
    centerStrength: z.number(),
    collideRadius: z.number(),
    collideStrength: z.number(),
    lineOpacity: z.number(),
    linkDistance: z.number(),
    linkWidth: z.number(),
    nodeSize: z.number()
});

export const schema = z.object({
    global: z.object({
        d3: graphD3Schema,
        dailyNote: z.boolean(),
        minRefs: z.number(),
        type: graphNodeSchema
    }),
    local: z.object({
        d3: graphD3Schema,
        dailyNote: z.boolean(),
        type: graphNodeSchema
    }),
    maxBlocks: z.number()
});

const parseAsConfig = (rawConf: {}): Config.IConf["graph"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
};