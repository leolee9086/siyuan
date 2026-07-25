import type { Type } from "arktype";
import type { StateSpaceBackend, 状态空间模式 } from "../core/types.js";
import { 匹配, 是子集, 有交集, 全集被模式集合覆盖 } from "../utils/setOps.js";

function requireArkTypePattern(pattern: 状态空间模式): Type<unknown> {
    const candidate = pattern as Type<unknown>;
    if (typeof candidate !== "function" ||
        typeof candidate.description !== "string" ||
        typeof candidate.extends !== "function" ||
        typeof candidate.and !== "function") {
        throw new TypeError("calibur-router/arktype: 状态空间模式必须是 ArkType Type。");
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
