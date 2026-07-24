/** 用途：拼音转换库。使用范围：pinyin 模块中文拼音搜索。解耦评估：通过 imports.ts 转发。 */
import { pinyin } from "./pinyin/imports";

/**
 * 将中文字符串转换为拼音字符串
 * @param text 要转换的中文文本
 * @returns 拼音字符串（不带声调）
 * @同步豁免: 性能考虑 — 纯计算转换（调用 pinyin-pro 库同步转换），无异步依赖
 */
export const convertToPinyin = (text: string) => {
    if (!text) {
return "";
}

    try {
        // 使用 pinyin-pro 库转换，去除声调，保留空格分隔
        const result = pinyin(text, { toneType: "none", type: "array" });
        return result.join(" ");
    } catch (error) {
        console.error("拼音转换错误:", error);
        return text;
    }
};

/**
 * 检查文本是否匹配搜索关键词（支持中文原文和拼音搜索）
 * @param text 要搜索的文本
 * @param keyword 搜索关键词
 * @returns 是否匹配
 * @同步豁免: 性能考虑 — 纯字符串匹配运算，无异步依赖
 */
export const matchPinyinSearch = (text: string, keyword: string) => {
    if (!keyword) {
return true;
}
    if (!text) {
return false;
}

    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    // 原文匹配
    if (lowerText.includes(lowerKeyword)) {
        return true;
    }

    // 拼音匹配
    const textPinyin = convertToPinyin(text).toLowerCase();
    if (textPinyin.includes(lowerKeyword)) {
        return true;
    }

    return false;
};
