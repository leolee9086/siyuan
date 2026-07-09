/**
 * 魔搭社区 (ModelScope) 客户端类型守卫
 */
/** 用途：思源代理响应类型。使用范围：魔搭 API 响应类型守卫。解耦评估：类型导入，不涉及运行时耦合。 */
import type { 思源代理响应 } from "./types";

/**
 * 思源代理 fetchSyncPost 的标准响应结构
 */
export interface 思源代理请求响应 {
    code: number;
    msg: string;
    data: 思源代理响应 | null;
}

/**
 * 检查一个值是否符合 思源代理响应 结构
 */
export const 检查思源代理响应 = (value: unknown): value is 思源代理响应 => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    return typeof obj.status === "number";
};

/**
 * 检查一个值是否符合 思源代理请求响应 结构
 */
export const 检查思源代理请求响应 = (value: unknown): value is 思源代理请求响应 => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    // 校验 code 和 msg 字段的类型是否符合预期，确保响应结构完整性
    if (typeof obj.code !== "number" || typeof obj.msg !== "string") {
        return false;
    }
    // data 字段允许为 null，非 null 时需通过次级类型守卫验证结构
    if (obj.data !== null && !检查思源代理响应(obj.data)) {
        return false;
    }
    return true;
};

/**
 * 断言响应为 思源代理请求响应 类型，如果不符合则抛出错误
 */
export function 断言思源代理请求响应(value: unknown): asserts value is 思源代理请求响应 {
    // 运行时断言：如果当前值不符合 思源代理请求响应 结构，抛出详细错误以便快速定位 API 兼容性问题
    if (!检查思源代理请求响应(value)) {
        const preview = JSON.stringify(value, null, 2).substring(0, 500);
        throw  Error(`fetchSyncPost 返回了非预期的响应结构: ${preview}`);
    }
}
