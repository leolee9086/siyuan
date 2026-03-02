import type { IpipPersonaProfile } from "../data/questionnaire.types";

/** @同步豁免: 类型守卫 - 需要同步返回布尔结果以驱动上层分支判断 */
/**
 * 作用：判断是否为内核错误响应结构。
 * 意图：识别 `/api/file/getFile` 的错误载荷并提前降级。
 * 调用时机：解析 profile 文件原始响应时调用。
 */
export function isKernelErrorResponse(payload: unknown): payload is { code: number } {
    if (!payload || typeof payload !== "object") {
        return false;
    }
    return "code" in payload && typeof (payload as { code?: unknown }).code === "number";
}

/** @同步豁免: 类型守卫 - 需要同步返回布尔结果以驱动上层分支判断 */
/**
 * 作用：校验对象是否满足最小 `IpipPersonaProfile` 结构。
 * 意图：防止非法文件内容进入提示词生成链路。
 * 调用时机：读取 profile 文件后调用。
 */
export function isIpipPersonaProfile(value: unknown): value is IpipPersonaProfile {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    const subject = record.subject as Record<string, unknown> | undefined;
    const personaBase = record.personaBase as Record<string, unknown> | undefined;
    // 缺失核心字段时视为无效 profile
    if (!subject || !personaBase) {
        return false;
    }
    if (record.schemaVersion !== "IPIP-NEO-120-v1") {
        return false;
    }
    return typeof subject.id === "string"
        && typeof subject.name === "string"
        && typeof personaBase.traits === "object"
        && typeof personaBase.facets === "object";
}

