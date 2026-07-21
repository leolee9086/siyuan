/** 用途：转换语言接口边界值。使用范围：独立入口语言加载。解耦评估：守卫集中在共享协议边界，无需宿主注入。 */
import {asStandaloneLanguage} from "./kernel.guard";
/** 用途：校验 Kernel 标准响应。使用范围：独立入口同源请求。解耦评估：守卫集中在共享协议边界，无需宿主注入。 */
import {parseStandaloneKernelResponse} from "./kernel.guard";

/** 向同源思源核心发送 JSON 请求并返回响应数据。 */
export const postStandaloneKernel = async <T>(path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`Kernel request failed: ${path} (${response.status})`);
    }
    const payload = parseStandaloneKernelResponse<T>(await response.json(), path);
    if (payload.code !== 0) {
        throw new Error(payload.msg || `Kernel request failed: ${path}`);
    }
    return payload.data;
};

/** 加载独立入口使用的语言字典。 */
export const fetchStandaloneLanguage = async (language: string) => {
    const response = await fetch(`/appearance/langs/${language}.json`);
    if (!response.ok) {
        throw new Error(`Failed to load language: ${language}`);
    }
    return asStandaloneLanguage(await response.json());
};
