import z from "zod"

export const schema = z.object({
    openAI: z.object({
        apiBaseURL: z.string(),
        apiKey: z.string(),
        apiMaxContexts: z.number(),
        apiMaxTokens: z.number(),
        apiModel: z.enum(["gpt-4", "gpt-4-32k", "gpt-3.5-turbo", "gpt-3.5-turbo-16k"]),
        apiProvider: z.enum(["OpenAI", "Azure"]),
        apiProxy: z.string(),
        apiTemperature: z.number(),
        apiTimeout: z.number(),
        apiUserAgent: z.string(),
        apiVersion: z.string()
    })
})

const parseAsConfig = (rawConf: {}): Config.IConf["ai"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
}