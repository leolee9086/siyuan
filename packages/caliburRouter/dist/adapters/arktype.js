import { 匹配, 是子集, 有交集, 全集被模式集合覆盖 } from "../utils/setOps.js";
function requireArkTypePattern(pattern) {
    const candidate = pattern;
    if (typeof candidate !== "function") {
        throw new TypeError("calibur-router/arktype: 状态空间模式必须来自调用方兼容的 ArkType Type；" +
            "缺少运行时能力: callable");
    }
    const missing = [];
    if (typeof candidate.description !== "string") {
        missing.push("description");
    }
    if (!("json" in candidate)) {
        missing.push("json");
    }
    const objectCandidate = candidate;
    for (const [name, value] of [
        ["and", candidate.and],
        ["or", candidate.or],
        ["extends", candidate.extends],
        ["get", objectCandidate.get],
        ["distribute", candidate.distribute],
    ]) {
        if (typeof value !== "function") {
            missing.push(name);
        }
    }
    if (missing.length > 0) {
        throw new TypeError("calibur-router/arktype: 状态空间模式必须来自调用方兼容的 ArkType Type；" +
            `缺少运行时能力: ${missing.join(", ")}`);
    }
    return candidate;
}
export const arktypeBackend = {
    name: "arktype",
    assertPattern(pattern) {
        requireArkTypePattern(pattern);
    },
    describe(pattern) {
        return requireArkTypePattern(pattern).description;
    },
    match: 匹配,
    isSubset: 是子集,
    overlaps: 有交集,
    covers: 全集被模式集合覆盖,
};
//# sourceMappingURL=arktype.js.map