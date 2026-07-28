import * as z from "zod";
import { FormalStatePattern } from "./formal/adapter.js";
import type { FormalUnit, PatternShapeState, PatternState } from "./index.js";
declare class ZodStatePatternImpl<out State> extends FormalStatePattern<State, z.ZodType<unknown>> {
    private readonly zodStatePatternBrand;
}
export type ZodStatePattern<State> = ZodStatePatternImpl<State>;
type ZodPatternShape = Readonly<Record<string, ZodStatePattern<unknown>>>;
export declare const zodBackend: import("./index.js").StateSpaceBackend;
export declare const zodCalibur: import("./index.js").CaliburRouter;
export declare const zodState: {
    fromSchema<const Schema extends z.ZodType>(schema: Schema): ZodStatePattern<z.output<Schema>>;
    toSchema<State>(pattern: ZodStatePattern<State>): z.ZodType<State>;
    literal<const Value extends FormalUnit>(value: Value): ZodStatePattern<Value>;
    enumerated<const First extends FormalUnit, const Rest extends readonly FormalUnit[]>(first: First, ...rest: Rest): ZodStatePattern<First | Rest[number]>;
    boolean(): ZodStatePattern<boolean>;
    string(): ZodStatePattern<string>;
    number(): ZodStatePattern<number>;
    object<const Shape extends ZodPatternShape>(shape: Shape): ZodStatePattern<PatternShapeState<Shape>>;
    union<const Patterns extends readonly [ZodStatePattern<unknown>, ...ZodStatePattern<unknown>[]]>(...patterns: Patterns): ZodStatePattern<PatternState<Patterns[number]>>;
};
export {};
//# sourceMappingURL=zod.d.ts.map