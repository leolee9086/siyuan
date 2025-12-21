import type { ForgeI18n } from "../../types/forgeI18n.types";

/**
 * Forge 翻译数据存储
 */
let forgeLanguages: Record<string, unknown> = {};

/**
 * 是否已初始化
 */
let initialized = false;

/**
 * 从多语言 JSON 中提取指定语言的值
 */
const extractLanguageValue = (obj: unknown, language: string): unknown => {
    if (!obj || typeof obj !== "object") {
        return obj;
    }

    const keys = Object.keys(obj as Record<string, unknown>);
    // 检查是否是语言对象（所有键都是 xx_XX 格式）
    const isLanguageObject = keys.length > 0 && keys.every(key => /^[a-z]{2}_[A-Z]{2}$/.test(key));

    if (isLanguageObject) {
        const langObj = obj as Record<string, unknown>;
        return langObj[language] || langObj["zh_CN"] || Object.values(langObj)[0];
    }

    // 递归处理嵌套对象
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = extractLanguageValue(value, language);
    }
    return result;
};

/**
 * 加载 Forge 翻译数据
 */
export const loadForgeI18n = async (): Promise<void> => {
    if (initialized) {
        return;
    }

    const language = window.siyuan?.config?.appearance?.lang || "zh_CN";
    const filePath = "conf/appearance/forge/lang/forge.i18n.json";

    try {
        // 使用 getFile API 加载，因为新路径不是默认静态文件伺服路径
        const response = await fetch("/api/file/getFile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ path: filePath })
        });

        if (!response.ok) {
            console.warn("[loadForgeI18n] Forge 翻译文件不存在");
            forgeLanguages = {};
            initialized = true;
            return;
        }

        const data = await response.json();
        console.log("[loadForgeI18n] 原始数据:", data);
        console.log("[loadForgeI18n] 原始数据的 keys:", Object.keys(data));
        forgeLanguages = extractLanguageValue(data, language) as Record<string, unknown>;
        console.log("[loadForgeI18n] 处理后数据:", forgeLanguages);
        console.log("[loadForgeI18n] 处理后数据的 keys:", Object.keys(forgeLanguages));
        initialized = true;
        console.log(`[loadForgeI18n] 已加载 ${language} 语言的 Forge 翻译`, forgeLanguages);
    } catch (e) {
        console.error("[loadForgeI18n] 加载失败:", e);
        forgeLanguages = {};
        initialized = true;
    }
};

/**
 * 手动初始化 Forge 翻译数据
 */
export const initForgeI18n = (data: Record<string, unknown>): void => {
    forgeLanguages = data;
    initialized = true;
};

/**
 * 创建 forgeI18n 代理
 * 模仿 siyuanI18n 的实现方式，同时处理数据未加载的情况
 */
const createForgeI18nProxy = (): ForgeI18n => {
    return new Proxy({} as ForgeI18n, {
        get(_, prop: string) {
            // 过滤 Vue 内部属性
            if (prop.startsWith("__v_") || prop === "_isVue" || prop === "_self") {
                return undefined;
            }

            // 直接从 forgeLanguages 获取值
            const directValue = forgeLanguages[prop];

            // 如果是字符串，直接返回
            if (typeof directValue === "string") {
                return directValue;
            }

            // 如果是对象，返回嵌套代理
            if (directValue && typeof directValue === "object") {
                return createNestedProxy(directValue as Record<string, unknown>, [prop]);
            }

            // 值不存在时，返回空对象代理以允许继续链式访问
            return createNestedProxy({}, [prop]);
        }
    });
};

/**
 * 创建嵌套代理，用于处理多层路径
 */
const createNestedProxy = (
    targetObj: Record<string, unknown>,
    path: string[]
): unknown => {
    return new Proxy(targetObj, {
        get(target, prop) {
            // Symbol 属性返回 undefined
            if (typeof prop === "symbol") {
                return undefined;
            }

            const propStr = String(prop);

            // 过滤 Vue 内部属性
            if (propStr.startsWith("__v_") || propStr === "_isVue" || propStr === "_self") {
                return undefined;
            }

            // toJSON 返回 undefined 避免 JSON.stringify 问题
            if (propStr === "toJSON") {
                return undefined;
            }

            // toString/valueOf 返回路径字符串
            if (propStr === "toString" || propStr === "valueOf") {
                const value = target[propStr];
                if (typeof value === "string") {
                    return () => value;
                }
                return () => [...path].join(".");
            }

            const value = target[propStr];

            // 如果是字符串，直接返回
            if (typeof value === "string") {
                return value;
            }

            // 如果是对象，继续返回嵌套代理
            if (value && typeof value === "object") {
                return createNestedProxy(value as Record<string, unknown>, [...path, propStr]);
            }

            // 值不存在，返回空对象代理以允许继续链式访问
            // 最终在模板中会显示路径字符串（通过 toString）
            return createNestedProxy({}, [...path, propStr]);
        }
    });
};

/**
 * 导出 forgeI18n 代理对象
 * 
 * @example
 * import { forgeI18n } from "...";
 * console.log(forgeI18n.modelScope.auth.标题); // "认证配置"
 */
export const forgeI18n: ForgeI18n = createForgeI18nProxy();

