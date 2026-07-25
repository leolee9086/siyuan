import { describeFormalStateSpace, formalCovers, formalIsSubset, formalOverlaps, } from "./stateSpace.js";
export class FormalStatePattern {
    backendToken;
    schema;
    stateSpace;
    constructor(backendToken, schema, stateSpace) {
        this.backendToken = backendToken;
        this.schema = schema;
        this.stateSpace = stateSpace;
    }
}
export function createFormalStateBackend(config) {
    const unwrap = (pattern) => {
        if (!(pattern instanceof FormalStatePattern) || pattern.backendToken !== config.token) {
            throw new TypeError(`calibur-router/${config.name}: 模式必须由该后端的形式化状态构造器创建。`);
        }
        return pattern;
    };
    return {
        name: config.name,
        assertPattern(pattern) {
            unwrap(pattern);
        },
        describe(pattern) {
            return describeFormalStateSpace(unwrap(pattern).stateSpace);
        },
        match(pattern, input) {
            return config.validates(unwrap(pattern).schema, input) ? input : null;
        },
        isSubset(left, right) {
            return formalIsSubset(unwrap(left).stateSpace, unwrap(right).stateSpace);
        },
        overlaps(left, right) {
            return formalOverlaps(unwrap(left).stateSpace, unwrap(right).stateSpace);
        },
        covers(universe, patterns) {
            return formalCovers(unwrap(universe).stateSpace, patterns.map((pattern) => unwrap(pattern).stateSpace));
        },
    };
}
//# sourceMappingURL=adapter.js.map