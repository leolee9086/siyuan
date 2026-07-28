import * as z from "zod";
import { FormalStatePattern } from "./formal/adapter.js";
import type { FormalUnit, PatternShapeState, PatternState } from "./index.js";
declare class ZodStatePatternImpl<out State, out Schema extends z.ZodType = z.ZodType> extends FormalStatePattern<State, Schema> {
    private readonly zodStatePatternBrand;
}
export type ZodStatePattern<State, Schema extends z.ZodType = z.ZodType> = ZodStatePatternImpl<State, Schema>;
type ZodPatternShape = Readonly<Record<string, ZodStatePattern<unknown>>>;
type IsAny<Value> = 0 extends 1 & Value ? true : false;
type IsUnknown<Value> = IsAny<Value> extends true ? false : unknown extends Value ? [keyof Value] extends [never] ? true : false : false;
type HasConcreteIdentityInputOutput<Schema extends z.ZodType> = IsAny<z.input<Schema>> extends true ? false : IsAny<z.output<Schema>> extends true ? false : IsUnknown<z.input<Schema>> extends true ? false : IsUnknown<z.output<Schema>> extends true ? false : [z.input<Schema>] extends [z.output<Schema>] ? [z.output<Schema>] extends [z.input<Schema>] ? true : false : false;
type PurePredicateSchemaGuard<Schema extends z.ZodType> = HasConcreteIdentityInputOutput<Schema> extends true ? object : {
    readonly __caliburRouterZodSchemaError__: "fromSchema requires concrete and identical Zod input/output types";
};
export declare const zodBackend: import("./index.js").StateSpaceBackend;
export declare const zodCalibur: import("./index.js").CaliburRouter;
export declare const zodState: {
    fromSchema<const Schema extends z.ZodType>(schema: Schema & PurePredicateSchemaGuard<NoInfer<Schema>>): ZodStatePattern<z.output<Schema>, Schema>;
    toSchema<State, Schema extends z.ZodType>(pattern: ZodStatePattern<State, Schema>): Schema;
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