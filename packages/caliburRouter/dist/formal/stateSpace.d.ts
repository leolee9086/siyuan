import type { FormalUnit } from "../core/types.js";
export type { FormalUnit } from "../core/types.js";
export type FormalDomain = "string" | "number" | "boolean";
export type FormalStateSpace = {
    readonly kind: "unit";
    readonly value: FormalUnit;
} | {
    readonly kind: "domain";
    readonly domain: FormalDomain;
} | {
    readonly kind: "object";
    readonly properties: Readonly<Record<string, FormalStateSpace>>;
} | {
    readonly kind: "union";
    readonly branches: readonly FormalStateSpace[];
};
export declare function formalUnit(value: FormalUnit): FormalStateSpace;
export declare function formalDomain(domain: FormalDomain): FormalStateSpace;
export declare function formalObject(properties: Readonly<Record<string, FormalStateSpace>>): FormalStateSpace;
export declare function formalUnion(branches: readonly FormalStateSpace[]): FormalStateSpace;
export declare function formalIsSubset(left: FormalStateSpace, right: FormalStateSpace): boolean;
export declare function formalIntersection(left: FormalStateSpace, right: FormalStateSpace): FormalStateSpace | null;
export declare function formalOverlaps(left: FormalStateSpace, right: FormalStateSpace): boolean;
export declare function formalCovers(universe: FormalStateSpace, patterns: readonly FormalStateSpace[]): boolean;
export declare function describeFormalStateSpace(space: FormalStateSpace): string;
//# sourceMappingURL=stateSpace.d.ts.map