/**
 * 将官方插件 API 允许的标量请求头值规范化为 Fetch 标准字符串头。
 * Promise 入口供两套现有网络适配器共享同一转换语义。
 */
export const normalizeRequestHeaders = async (headers: HeadersInit | IObject | null | undefined) => {
    if (!headers) {
        return undefined;
    }
    if (headers instanceof Headers || Array.isArray(headers)) {
        return headers;
    }
    const normalized: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers)) {
        normalized[name] = String(value);
    }
    return normalized;
};
