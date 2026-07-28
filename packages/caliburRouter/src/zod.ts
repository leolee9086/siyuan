import * as z from "zod";
import { createCaliburRouter } from "./core/matcher.js";
import {
    createFormalStateBackend,
    FormalStatePattern,
} from "./formal/adapter.js";
import type {FormalUnit, PatternShapeState, PatternState} from "./index.js";
import {
    formalDomain,
    formalObject,
    formalUnion,
    formalUnit,
    type FormalStateSpace,
} from "./formal/stateSpace.js";
import { parseFormalJsonSchema } from "./formal/jsonSchema.js";

const zodBackendToken = {};

class ZodStatePatternImpl<
    out State,
    out Schema extends z.ZodType = z.ZodType,
> extends FormalStatePattern<State, Schema> {
    declare private readonly zodStatePatternBrand: void;
}

export type ZodStatePattern<
    State,
    Schema extends z.ZodType = z.ZodType,
> = ZodStatePatternImpl<State, Schema>;

type ZodPatternShape = Readonly<Record<string, ZodStatePattern<unknown>>>;

type IsAny<Value> = 0 extends 1 & Value ? true : false;

type IsUnknown<Value> = IsAny<Value> extends true
    ? false
    : unknown extends Value
        ? [keyof Value] extends [never] ? true : false
        : false;

type HasConcreteIdentityInputOutput<Schema extends z.ZodType> =
    IsAny<z.input<Schema>> extends true ? false
        : IsAny<z.output<Schema>> extends true ? false
            : IsUnknown<z.input<Schema>> extends true ? false
                : IsUnknown<z.output<Schema>> extends true ? false
                    : [z.input<Schema>] extends [z.output<Schema>]
                        ? [z.output<Schema>] extends [z.input<Schema>] ? true : false
                        : false;

type PurePredicateSchemaGuard<Schema extends z.ZodType> =
    HasConcreteIdentityInputOutput<Schema> extends true
        ? object
        : {
            readonly __caliburRouterZodSchemaError__:
                "fromSchema requires concrete and identical Zod input/output types";
        };

function createPattern<State, Schema extends z.ZodType = z.ZodType>(
    schema: Schema,
    stateSpace: FormalStateSpace,
): ZodStatePattern<State, Schema> {
    return new ZodStatePatternImpl(zodBackendToken, schema, stateSpace);
}

function unwrap<State, Schema extends z.ZodType>(
    pattern: ZodStatePattern<State, Schema>,
): ZodStatePatternImpl<State, Schema> {
    if (!(pattern instanceof ZodStatePatternImpl) || pattern.backendToken !== zodBackendToken) {
        throw new TypeError("calibur-router/zod: 模式必须由 zodState 构造。");
    }
    return pattern;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isZodSchema(value: unknown): value is z.ZodType {
    return isRecord(value) &&
        typeof value.type === "string" &&
        isRecord(value.def) &&
        typeof value.safeParse === "function";
}

function isZodObject(schema: z.ZodType): schema is z.ZodObject {
    return schema.type === "object" && "shape" in schema && isRecord(schema.shape);
}

function isZodUnion(schema: z.ZodType): schema is z.ZodUnion {
    return schema.type === "union" && "options" in schema && Array.isArray(schema.options);
}

function assertSupportedZodSchema(schema: z.ZodType, path = "schema"): void {
    const definition = schema.def;
    if ("coerce" in definition && definition.coerce === true) {
        throw new TypeError(`calibur-router/zod: ${path} 包含 coerce，路由不会传递解析后的转换值。`);
    }
    if (Array.isArray(definition.checks) && definition.checks.length > 0) {
        throw new TypeError(`calibur-router/zod: ${path} 包含 checks/refinement，不能参与集合证明。`);
    }

    switch (schema.type) {
        case "string":
        case "number":
        case "boolean":
        case "null":
        case "literal":
        case "enum":
            return;
        case "object": {
            if (!isZodObject(schema)) {
                throw new TypeError(`calibur-router/zod: ${path} 的 object 公开结构无效。`);
            }
            if ("catchall" in definition && definition.catchall !== undefined) {
                throw new TypeError(`calibur-router/zod: ${path} 包含 catchall，当前形式化子集未定义该语义。`);
            }
            for (const [key, property] of Object.entries(schema.shape)) {
                if (!isZodSchema(property)) {
                    throw new TypeError(`calibur-router/zod: ${path}.${key} 不是 Zod Schema。`);
                }
                assertSupportedZodSchema(property, `${path}.${key}`);
            }
            return;
        }
        case "union": {
            if (!isZodUnion(schema) || !schema.options.every(isZodSchema)) {
                throw new TypeError(`calibur-router/zod: ${path} 的 union 分支无效。`);
            }
            schema.options.forEach((option, index) =>
                assertSupportedZodSchema(option, `${path}[${index}]`)
            );
            return;
        }
        default:
            throw new TypeError(
                `calibur-router/zod: ${path} 使用了不受支持的 ${schema.type} Schema。`
            );
    }
}

export const zodBackend = createFormalStateBackend<z.ZodType<unknown>>({
    name: "zod",
    token: zodBackendToken,
    validates: (schema, input) => schema.safeParse(input).success,
});

export const zodCalibur = createCaliburRouter(zodBackend);

export const zodState = {
    fromSchema<const Schema extends z.ZodType>(
        schema: Schema & PurePredicateSchemaGuard<NoInfer<Schema>>,
    ): ZodStatePattern<z.output<Schema>, Schema> {
        assertSupportedZodSchema(schema);
        const jsonSchema = z.toJSONSchema(schema, { io: "input", unrepresentable: "throw" });
        return createPattern<z.output<Schema>, Schema>(schema, parseFormalJsonSchema(jsonSchema));
    },

    toSchema<State, Schema extends z.ZodType>(pattern: ZodStatePattern<State, Schema>): Schema {
        return unwrap(pattern).schema;
    },

    literal<const Value extends FormalUnit>(value: Value): ZodStatePattern<Value> {
        return createPattern(z.literal(value), formalUnit(value));
    },

    enumerated<const First extends FormalUnit, const Rest extends readonly FormalUnit[]>(
        first: First,
        ...rest: Rest
    ): ZodStatePattern<First | Rest[number]> {
        const values: readonly FormalUnit[] = [first, ...rest];
        const schemas = values.map((value) => z.literal(value));
        let schema: z.ZodType<unknown> = schemas[0];
        for (let index = 1; index < schemas.length; index++) {
            schema = schema.or(schemas[index]);
        }
        return createPattern(schema, formalUnion(values.map(formalUnit)));
    },

    boolean(): ZodStatePattern<boolean> {
        return createPattern(z.boolean(), formalDomain("boolean"));
    },

    string(): ZodStatePattern<string> {
        return createPattern(z.string(), formalDomain("string"));
    },

    number(): ZodStatePattern<number> {
        return createPattern(z.number(), formalDomain("number"));
    },

    object<const Shape extends ZodPatternShape>(
        shape: Shape,
    ): ZodStatePattern<PatternShapeState<Shape>> {
        const schemaShape: Record<string, z.ZodType<unknown>> = {};
        const properties: Record<string, FormalStateSpace> = {};
        for (const [key, pattern] of Object.entries(shape)) {
            const unwrapped = unwrap(pattern);
            schemaShape[key] = unwrapped.schema;
            properties[key] = unwrapped.stateSpace;
        }
        return createPattern(z.object(schemaShape), formalObject(properties));
    },

    union<const Patterns extends readonly [ZodStatePattern<unknown>, ...ZodStatePattern<unknown>[]]>(
        ...patterns: Patterns
    ): ZodStatePattern<PatternState<Patterns[number]>> {
        const unwrapped = patterns.map(unwrap);
        let schema = unwrapped[0].schema;
        for (let index = 1; index < unwrapped.length; index++) {
            schema = schema.or(unwrapped[index].schema);
        }
        return createPattern(schema, formalUnion(unwrapped.map((pattern) => pattern.stateSpace)));
    },
};
