/**
 * @fileoverview AI配置加载器
 * @description 从思源工作空间数据存储路径加载AI配置，替代原始toolBox依赖
 */

import type { ConfigLoaderDeps, MardukValidatedConfig } from "./core.types";
import { asRecord } from "./configLoader.guard";

/** 默认AI配置 */
const DEFAULT_AI_CONFIG: MardukValidatedConfig = {
    apiKey: "",
    baseURL: "",
    model: "gpt-4",
    timeout: 30000,
    maxTokens: 4096,
    temperature: 0.7,
};

/** AI配置文件名 */
const AI_CONFIG_FILENAME = "ai-config.json";

/**
 * 从未知值中提取字符串字段
 * @param obj - 未知对象
 * @param key - 字段名
 * @param fallback - 回退值
 * @returns 字符串值或回退值
 */
function extractString(obj: Record<string, unknown>, key: string, fallback: string): string {
    const val = obj[key];
    return typeof val === "string" ? val : fallback;
}

/**
 * 从未知值中提取数字字段
 * @param obj - 未知对象
 * @param key - 字段名
 * @param fallback - 回退值
 * @returns 数字值或回退值
 */
function extractNumber(obj: Record<string, unknown>, key: string, fallback: number): number {
    const val = obj[key];
    return typeof val === "number" ? val : fallback;
}

/**
 * 安全解析JSON并合并为完整配置，失败时返回null
 * @param raw - 原始JSON字符串
 * @returns 合并后的完整配置或null
 */
function parseAndMergeConfig(raw: string): MardukValidatedConfig | null {
    try {
        // 解析JSON字符串并通过类型守卫验证
        const parsed: unknown = JSON.parse(raw);
        const obj = asRecord(parsed);
        if (!obj) {
            return null;
        }
        return {
            apiKey: extractString(obj, "apiKey", DEFAULT_AI_CONFIG.apiKey),
            baseURL: extractString(obj, "baseURL", DEFAULT_AI_CONFIG.baseURL),
            model: extractString(obj, "model", DEFAULT_AI_CONFIG.model),
            timeout: extractNumber(obj, "timeout", DEFAULT_AI_CONFIG.timeout),
            maxTokens: extractNumber(obj, "maxTokens", DEFAULT_AI_CONFIG.maxTokens),
            temperature: extractNumber(obj, "temperature", DEFAULT_AI_CONFIG.temperature),
            _meta: {
                source: "workspace",
                loadedAt: new Date(),
                isDefault: false,
            },
        };
    } catch {
        return null;
    }
}

/**
 * 从思源工作空间路径加载AI配置
 * @param deps - 配置加载器依赖（文件系统适配器和数据存储路径）
 * @returns 加载后的AI配置
 */
export async function loadAIConfigFromWorkspace(
    deps: ConfigLoaderDeps
): Promise<MardukValidatedConfig> {
    const configPath = `${deps.dataStoragePath}/${AI_CONFIG_FILENAME}`;

    try {
        // 读取配置文件内容
        const raw = await deps.fs.readFile(configPath);
        const config = parseAndMergeConfig(raw);

        if (!config) {
            // 配置文件内容无效，回退到默认配置
            return { ...DEFAULT_AI_CONFIG, _meta: { isDefault: true, loadedAt: new Date() } };
        }

        return config;
    } catch {
        // 配置文件不存在或读取失败，回退到默认配置
        return { ...DEFAULT_AI_CONFIG, _meta: { isDefault: true, loadedAt: new Date() } };
    }
}
