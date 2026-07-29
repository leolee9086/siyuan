/** 用途：认证失效后重载当前页面。使用范围：HTTP 401 响应；解耦评估：由本子域 imports.ts 直达可替换的 location 环境实现。 */
import {reloadLocation} from "./imports";

/**
 * 处理 HTTP 响应并保留既有状态码、JSON 与纯文本语义。
 * 401 延迟触发重载，403/404 转为标准错误消息，其余响应按 Content-Type 解码。
 */
export const handleFetchResponse = async (response: Response) => {
    // 权限不足或资源缺失时维持旧协议，向上层返回可由 processMessage 处理的标准错误消息。
    if (response.status === 403 || response.status === 404) {
        return {
            data: null,
            msg: response.statusText,
            code: -response.status,
        };
    }
    // 认证失效时先返回标准错误，并为用户保留观察当前界面状态的短暂时间后重载登录流程。
    if (response.status === 401) {
        // 该 3 秒是既有的用户感知延迟；重载没有可等待的外部完成信号，立即执行会隐藏认证错误现场。
        setTimeout(() => {
            reloadLocation();
        }, 3000);
        return {
            data: null,
            msg: response.statusText,
            code: -response.status,
        };
    }
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
        return await response.json();
    }
    return await response.text();
};
