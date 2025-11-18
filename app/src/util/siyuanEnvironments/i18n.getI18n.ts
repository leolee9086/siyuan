import type { SiYuanI18n, I18nKeys } from '../../types/i18n.types';

/**
 * 获取国际化文本的工具函数
 * @param key 国际化文本的键
 * @returns 如果键存在则返回对应的值，否则警告并返回键本身
 */
const getI18n = (key: I18nKeys): string => {
    const currentLang = window.siyuan?.config?.lang
    if (!window.siyuan?.languages) {
        console.warn(`[getI18n] window.siyuan.languages 不存在，返回键: ${key}`);
        return key as string;
    }

    // 处理嵌套路径，例如 "replaceTypes.text"
    const keyPath = (key as string).split('.');
    let value: any = window.siyuan.languages;
    
    for (const pathPart of keyPath) {
        if (value && typeof value === 'object' && pathPart in value) {
            value = value[pathPart];
        } else {
            console.warn(`[getI18n] 未找到键 "${key}" 在语言${currentLang}对应的国际化文本`);
            return key as string;
        }
    }
    
    if (typeof value === 'string') {
        return value;
    }
    
    console.warn(`[getI18n] 键 "${key}" 对应的值不是字符串类型`);
    return key as string;
};

/**
 * 创建一个代理对象，用于访问国际化文本
 * 当访问不存在的键时，会自动警告并返回键本身
 */
 const createI18nProxy = (): SiYuanI18n => {
    return new Proxy({} as SiYuanI18n, {
        get(target, prop: string) {
            // 过滤掉Vue的内部属性，避免不必要的i18n查找
            if (prop.startsWith('__v_') || prop === '_isVue' || prop === '_self') {
                return undefined;
            }
            
            // 首先尝试直接获取值
            const directValue = getI18n(prop as I18nKeys);
            
            // 如果直接获取到的值是字符串，直接返回
            if (typeof directValue === 'string' && directValue !== prop) {
                return directValue;
            }
            
            // 如果直接获取不到或者获取到的不是字符串，尝试获取对象值
            const objValue = window.siyuan?.languages?.[prop as keyof SiYuanI18n];
            if (objValue && typeof objValue === 'object') {
                // 返回一个嵌套代理，用于访问对象的属性
                return new Proxy(objValue, {
                    get(_, nestedProp: string) {
                        // 同样过滤掉Vue的内部属性
                        if (nestedProp.startsWith('__v_') || nestedProp === '_isVue' || nestedProp === '_self') {
                            return undefined;
                        }
                        const fullPath = `${prop}.${nestedProp}`;
                        return getI18n(fullPath as I18nKeys);
                    }
                });
            }
            
            // 如果都获取不到，返回原始键
            return directValue;
        }
    });
};

/**
 * 导出i18n代理对象，可以直接像window.siyuan.languages一样使用
 * 例如：i18n.cancel 获取取消按钮的文本
 */
export const siyuanI18n = createI18nProxy();