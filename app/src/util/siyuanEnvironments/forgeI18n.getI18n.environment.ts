import type { ForgeI18n, ForgeI18nKeys } from "../../types/forgeI18n.types";

/**
 * Forge 翻译数据存储
 * 在运行时加载 forge 翻译数据
 */
let forgeLanguages: Record<string, unknown> | null = null;

/**
 * 初始化 Forge 翻译数据
 * @param data Forge 翻译数据
 */
export const initForgeI18n = (data: Record<string, unknown>): void => {
    forgeLanguages = data;
};

/**
 * 获取 Forge 国际化文本的工具函数
 * @param key 国际化文本的键
 * @returns 如果键存在则返回对应的值，否则警告并返回键本身
 */
const getForgeI18n = (key: ForgeI18nKeys): string => {
    if (!forgeLanguages) {
        console.warn(`[getForgeI18n] Forge 翻译数据未初始化，返回键: ${key}`);
        return key as string;
    }

    // 处理嵌套路径，例如 "书签面板.标题"
    const keyPath = (key as string).split(".");
    let value: unknown = forgeLanguages;

    for (const pathPart of keyPath) {
        // 卫语句：条件不满足时提前返回
        if (!value || typeof value !== "object" || !(pathPart in value)) {
            console.warn(`[getForgeI18n] 未找到键 "${key}" 对应的 Forge 翻译`);
            return key as string;
        }
        value = (value as Record<string, unknown>)[pathPart];
    }

    if (typeof value === "string") {
        return value;
    }

    console.warn(`[getForgeI18n] 键 "${key}" 对应的值不是字符串类型`);
    return key as string;
};

/**
 * 创建 Forge 代理对象，用于访问 Forge 翻译
 */
const createForgeI18nProxy = (): ForgeI18n => {
    return new Proxy({} as ForgeI18n, {
        get(target, prop: string) {
            // 过滤掉 Vue 的内部属性
            if (prop.startsWith("__v_") || prop === "_isVue" || prop === "_self") {
                return undefined;
            }

            // 首先尝试直接获取值
            const directValue = getForgeI18n(prop as ForgeI18nKeys);

            // 如果直接获取到的值是字符串，直接返回
            if (typeof directValue === "string" && directValue !== prop) {
                return directValue;
            }

            // 如果直接获取不到或者获取到的不是字符串，尝试获取对象值
            const objValue = forgeLanguages?.[prop as keyof ForgeI18n];
            if (objValue && typeof objValue === "object") {
                // 返回一个嵌套代理，用于访问对象的属性
                return new Proxy(objValue, {
                    get(_, nestedProp: string) {
                        // 同样过滤掉 Vue 的内部属性
                        if (nestedProp.startsWith("__v_") || nestedProp === "_isVue" || nestedProp === "_self") {
                            return undefined;
                        }
                        const fullPath = `${prop}.${nestedProp}`;
                        return getForgeI18n(fullPath as ForgeI18nKeys);
                    }
                });
            }

            // 如果都获取不到，返回原始键
            return directValue;
        }
    });
};

/**
 * 导出 forgeI18n 代理对象
 * 例如：forgeI18n.书签面板.标题 获取书签面板标题的翻译
 */
export const forgeI18n = createForgeI18nProxy();
