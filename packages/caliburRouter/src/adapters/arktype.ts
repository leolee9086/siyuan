import type { Type } from "arktype";
import type { StateSpaceBackend, 状态空间模式 } from "../core/types.js";
import { 匹配, 是子集, 有交集, 全集被模式集合覆盖 } from "../utils/setOps.js";

function requireArkTypePattern(pattern: 状态空间模式): Type<unknown> {
    const candidate = pattern as Type<unknown>;
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

export const arktypeBackend: StateSpaceBackend = {
    name: "arktype",
    assertPattern(pattern): void {
        requireArkTypePattern(pattern);
    },
    describe(pattern): string {
        return requireArkTypePattern(pattern).description;
    },
    match: 匹配,
    isSubset: 是子集,
    overlaps: 有交集,
    covers: 全集被模式集合覆盖,
};
