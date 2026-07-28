import type { StateSpaceBackend, 状态空间模式 } from "../core/types.js";
import {
    describeFormalStateSpace,
    formalCovers,
    formalIsSubset,
    formalOverlaps,
    type FormalStateSpace,
} from "./stateSpace.js";

export class FormalStatePattern<out State, out Schema> {
    declare readonly infer: State;

    constructor(
        readonly backendToken: object,
        readonly schema: Schema,
        readonly stateSpace: FormalStateSpace,
    ) {}
}

export interface FormalStateBackendConfig<Schema> {
    readonly name: string;
    readonly token: object;
    readonly validates: (schema: Schema, input: unknown) => boolean;
}

export function createFormalStateBackend<Schema>(
    config: FormalStateBackendConfig<Schema>,
): StateSpaceBackend {
    const unwrap = (pattern: 状态空间模式): FormalStatePattern<unknown, Schema> => {
        if (!(pattern instanceof FormalStatePattern) || pattern.backendToken !== config.token) {
            throw new TypeError(
                `calibur-router/${config.name}: 模式必须由该后端的形式化状态构造器创建。`
            );
        }
        return pattern as FormalStatePattern<unknown, Schema>;
    };

    return {
        name: config.name,
        assertPattern(pattern): void {
            unwrap(pattern);
        },
        describe(pattern): string {
            return describeFormalStateSpace(unwrap(pattern).stateSpace);
        },
        match<State>(pattern: 状态空间模式<State>, input: unknown): State | null {
            return config.validates(unwrap(pattern).schema, input) ? input as State : null;
        },
        isSubset(left, right): boolean {
            return formalIsSubset(unwrap(left).stateSpace, unwrap(right).stateSpace);
        },
        overlaps(left, right): boolean {
            return formalOverlaps(unwrap(left).stateSpace, unwrap(right).stateSpace);
        },
        covers(universe, patterns): boolean {
            return formalCovers(
                unwrap(universe).stateSpace,
                patterns.map((pattern) => unwrap(pattern).stateSpace),
            );
        },
    };
}
