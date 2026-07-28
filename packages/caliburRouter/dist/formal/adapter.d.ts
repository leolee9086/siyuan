import type { StateSpaceBackend } from "../core/types.js";
import { type FormalStateSpace } from "./stateSpace.js";
export declare class FormalStatePattern<out State, out Schema> {
    readonly backendToken: object;
    readonly schema: Schema;
    readonly stateSpace: FormalStateSpace;
    readonly infer: State;
    constructor(backendToken: object, schema: Schema, stateSpace: FormalStateSpace);
}
export interface FormalStateBackendConfig<Schema> {
    readonly name: string;
    readonly token: object;
    readonly validates: (schema: Schema, input: unknown) => boolean;
}
export declare function createFormalStateBackend<Schema>(config: FormalStateBackendConfig<Schema>): StateSpaceBackend;
//# sourceMappingURL=adapter.d.ts.map