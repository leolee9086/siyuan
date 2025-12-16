import { z } from "zod";

// API 提供商类型
const apiProviderSchema = z.enum(["OpenAI", "Azure"]);

// API 模型类型
const apiModelSchema = z.string();

// URL 验证函数
const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// OpenAI 配置子模式
const openAIConfigSchema = z.object({
    apiBaseURL: z.url()
        .min(1, "API基础URL不能为空")
        .refine(isValidUrl, "API基础URL格式无效"),
    apiKey: z.string()
        .min(1, "API密钥不能为空")
        .max(200, "API密钥长度不能超过200个字符"),
    apiMaxContexts: z.number()
        .int("最大上下文数必须为整数")
        .min(1, "最大上下文数至少为1")
        .max(100, "最大上下文数不能超过100"),
    apiMaxTokens: z.number()
        .int("最大令牌数必须为整数")
        .min(1, "最大令牌数至少为1")
        .max(128000, "最大令牌数不能超过128000"),
    apiModel: apiModelSchema,
    apiProvider: apiProviderSchema,
    apiProxy: z.string()
        .refine((val) => !val || isValidUrl(val), "代理URL格式无效")
        .default(""),
    apiTemperature: z.number()
        .min(0, "温度值不能小于0")
        .max(2, "温度值不能大于2")
        .default(0.7),
    apiTimeout: z.number()
        .int("超时时间必须为整数")
        .min(1000, "超时时间至少为1000毫秒")
        .max(300000, "超时时间不能超过300000毫秒")
        .default(30000),
    apiUserAgent: z.string()
        .min(1, "用户代理不能为空")
        .max(200, "用户代理长度不能超过200个字符")
        .default("SiYuan/3.4.0 std/windows"),
    apiVersion: z.string()
        .min(1, "API版本不能为空")
        .max(50, "API版本长度不能超过50个字符")
        .default("2023-12-01-preview")
});

// 主配置模式
const schema = z.object({
    openAI: openAIConfigSchema
});

export { schema as aiConfigSchema };

// 从 schema 推断类型
type InferredAIConfig = z.infer<typeof schema>;

// 类型兼容性检查
type IsCompatible = InferredAIConfig extends Config.IConf["ai"]
    ? Config.IConf["ai"] extends InferredAIConfig
    ? true
    : false
    : false;
type check = IsCompatible extends true ? true : never;

// 编译时类型验证函数
function validateTypeCompatibility(): InferredAIConfig {
    return {} as Config.IConf["ai"]; // 如果类型不匹配，这里会报错
}

function validateTypeCompatibilityReverse(): Config.IConf["ai"] {
    return {} as InferredAIConfig; // 如果类型不匹配，这里会报错
}

// 解析函数
export const parseAsAiConfig = (rawConf: {}): Config.IConf["ai"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        // 提供更详细的错误信息
        const errorDetails = result.error.issues.map(issue => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code
        }));
        
        throw new Error(`AI配置解析失败: ${JSON.stringify(errorDetails, null, 2)}`);
    }

    return result.data;
};