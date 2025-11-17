import z from "zod"

export const schema = z.object({
    deck: z.boolean(),
    heading: z.boolean(),
    list: z.boolean(),
    mark: z.boolean(),
    maximumInterval: z.number(),
    newCardLimit: z.number(),
    requestRetention: z.number(),
    reviewCardLimit: z.number(),
    reviewMode: z.number(),
    superBlock: z.boolean(),
    weights: z.string()
})

const parseAsConfig = (rawConf: {}): Config.IConf["flashcard"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
}