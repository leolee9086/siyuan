import type { StateSpaceBackend, 状态空间模式 } from "../core/types.js";
import { assertArkTypePattern } from "./arktypePattern.js";
import { 匹配, 是子集, 有交集, 全集被模式集合覆盖 } from "../utils/setOps.js";

export const arktypeBackend: StateSpaceBackend = {
    name: "arktype",
    assertPattern(pattern): void {
        assertArkTypePattern(pattern);
    },
    describe(pattern): string {
        return assertArkTypePattern(pattern).description;
    },
    match: 匹配,
    isSubset: 是子集,
    overlaps: 有交集,
    covers: 全集被模式集合覆盖,
};
