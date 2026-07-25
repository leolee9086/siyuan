import * as Schema from "effect/Schema";
import { FormalStatePattern, type PatternShapeState, type PatternState } from "./formal/adapter.js";
import { type FormalUnit } from "./formal/stateSpace.js";
declare class EffectStatePatternImpl<out State> extends FormalStatePattern<State, Schema.Schema.AnyNoContext> {
    private readonly effectStatePatternBrand;
}
export type EffectStatePattern<State> = EffectStatePatternImpl<State>;
type EffectPatternShape = Readonly<Record<string, EffectStatePattern<unknown>>>;
export declare const effectBackend: import("./index.js").StateSpaceBackend;
export declare const effectCalibur: import("./index.js").CaliburRouter;
export declare const effectState: {
    fromSchema<const NativeSchema extends Schema.Schema.AnyNoContext>(schema: NativeSchema): EffectStatePattern<Schema.Schema.Type<NativeSchema>>;
    toSchema<State>(pattern: EffectStatePattern<State>): Schema.Schema<State, State, never>;
    literal<const Value extends FormalUnit>(value: Value): EffectStatePattern<Value>;
    enumerated<const First extends FormalUnit, const Rest extends readonly FormalUnit[]>(first: First, ...rest: Rest): EffectStatePattern<First | Rest[number]>;
    boolean(): EffectStatePattern<boolean>;
    string(): EffectStatePattern<string>;
    number(): EffectStatePattern<number>;
    object<const Shape extends EffectPatternShape>(shape: Shape): EffectStatePattern<PatternShapeState<Shape>>;
    union<const Patterns extends readonly [EffectStatePattern<unknown>, ...EffectStatePattern<unknown>[]]>(...patterns: Patterns): EffectStatePattern<PatternState<Patterns[number]>>;
};
export {};
//# sourceMappingURL=effect.d.ts.map