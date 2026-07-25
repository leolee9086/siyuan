/**
 * 用途：HTML 属性转义函数。
 * 使用范围：URL 单元格的 data-href 属性。
 * 解耦评估：经 cell 领域网关复用 DOM 转义唯一实现。
 */
import {escapeAttr} from "./imports";

/** 将 HTTP URL 的长路径压缩为既有的首四位和末六位展示格式。 */
const getDisplaySuffix = (url: URL) => {
    const suffix = url.href.replace(url.origin, "");
    if (suffix.length <= 12) {
        return suffix;
    }
    return `${suffix.substring(0, 4)}...${suffix.substring(suffix.length - 6)}`;
};

/**
 * 作用：将 URL 单元格值渲染为可点击的安全 HTML。
 * 意图：让普通单元格与 Rollup 单向复用同一 URL 表现规则，避免渲染器互相导入。
 * 调用时机：两类渲染器处理 url 类型值时同步调用。
 * 问题/改进：非 HTTP URL 和解析失败的值保持原有纯文本展示语义。
 * @同步豁免: UI构建 - 纯字符串拼接。
 */
export const renderCellURL = (urlContent: string) => {
    let host = urlContent;
    let suffix = "";
    try {
        const url = new URL(urlContent);
        // 仅 HTTP(S) 地址拆分主机与路径；其他协议保持完整原文。
        if (url.protocol.startsWith("http")) {
            host = url.host;
            suffix = getDisplaySuffix(url);
        }
    } catch (error) {
        // 非 URL 值按原始文本展示。
    }
    return `<span class="av__celltext av__celltext--url" data-type="url" data-href="${escapeAttr(urlContent)}"><span>${Lute.EscapeHTMLStr(host)}</span><span class="ft__on-surface">${Lute.EscapeHTMLStr(suffix)}</span></span>`;
};
