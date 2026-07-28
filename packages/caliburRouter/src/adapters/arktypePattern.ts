import type { Type } from "arktype";
import type { 状态空间模式 } from "../core/types.js";

/** ArkType 的跨实例适配边界。 */
export type ArkTypePattern = Type<unknown>;

type ArkTypeBinder = {
    bindReference(reference: ArkTypePattern): ArkTypePattern;
};

function isArkTypeBinder(value: object | null | undefined): value is ArkTypeBinder {
    return value !== null && typeof value === "object" &&
        "bindReference" in value && typeof value.bindReference === "function";
}

/**
 * 校验 CaliburRouter 使用到的完整 ArkType 运行时表面。
 *
 * `Scope.internal.bindReference` 是跨 ArkType scope 归一化所需的公开
 * 适配能力。缺失时立即失败，不能退回到直接组合不同 scope 的节点。
 */
export function assertArkTypePattern(pattern: 状态空间模式): ArkTypePattern {
    const candidate = pattern as ArkTypePattern;
    if (typeof candidate !== "function") {
        throw new TypeError(
            "calibur-router/arktype: 状态空间模式必须来自调用方兼容的 ArkType Type；" +
            "缺少运行时能力: callable",
        );
    }
    const missing: string[] = [];
    if (typeof candidate.description !== "string") {
        missing.push("description");
    }
    if (!("json" in candidate)) {
        missing.push("json");
    }
    const scope = candidate.$;
    if (!scope || typeof scope !== "object") {
        missing.push("$");
    } else {
        const internal: object | undefined = scope.internal;
        if (!isArkTypeBinder(internal)) {
            missing.push("$.internal.bindReference");
        }
    }
    const objectCandidate = candidate as Type<Record<string, unknown>>;
    for (const [name, value] of [
        ["and", candidate.and],
        ["or", candidate.or],
        ["extends", candidate.extends],
        ["get", objectCandidate.get],
        ["distribute", candidate.distribute],
    ] as const) {
        if (typeof value !== "function") {
            missing.push(name);
        }
    }
    if (missing.length > 0) {
        throw new TypeError(
            "calibur-router/arktype: 状态空间模式必须来自调用方兼容的 ArkType Type；" +
            `缺少运行时能力: ${missing.join(", ")}`,
        );
    }
    return candidate;
}

/** 将模式绑定到目标模式的 Scope，避免跨 ArkType 版本或 scope 直接组合节点。 */
export function bindArkTypePattern<目标状态 = unknown>(
    target: ArkTypePattern,
    source: 状态空间模式<目标状态>,
): ArkTypePattern {
    const targetPattern = assertArkTypePattern(target);
    const sourcePattern = assertArkTypePattern(source);
    if (targetPattern.$ === sourcePattern.$) {
        return sourcePattern;
    }
    const internal: object | undefined = targetPattern.$.internal;
    if (!isArkTypeBinder(internal)) {
        throw new TypeError(
            "calibur-router/arktype: 目标 ArkType Scope 缺少 $.internal.bindReference。",
        );
    }
    try {
        return internal.bindReference(sourcePattern);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new TypeError(
            "calibur-router/arktype: 无法将状态空间模式绑定到目标 ArkType Scope；" +
            `源描述: ${sourcePattern.description}; 目标描述: ${targetPattern.description}; ${message}`,
            {cause: error},
        );
    }
}
