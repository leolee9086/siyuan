import { assertArkTypePattern } from "./arktypePattern.js";
import { 匹配, 是子集, 有交集, 全集被模式集合覆盖 } from "../utils/setOps.js";
export const arktypeBackend = {
    name: "arktype",
    assertPattern(pattern) {
        assertArkTypePattern(pattern);
    },
    describe(pattern) {
        return assertArkTypePattern(pattern).description;
    },
    match: 匹配,
    isSubset: 是子集,
    overlaps: 有交集,
    covers: 全集被模式集合覆盖,
};
//# sourceMappingURL=arktype.js.map