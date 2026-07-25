import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { createCaliburRouter } from "./core/matcher.js";
import {
    createFormalStateBackend,
    FormalStatePattern,
    type PatternShapeState,
    type PatternState,
} from "./formal/adapter.js";
import {
    formalDomain,
    formalObject,
    formalUnion,
    formalUnit,
    type FormalStateSpace,
    type FormalUnit,
} from "./formal/stateSpace.js";

const effectBackendToken = {};

class EffectStatePatternImpl<out State> extends FormalStatePattern<State, Schema.Schema.AnyNoContext> {
    declare private readonly effectStatePatternBrand: void;
}

export type EffectStatePattern<State> = EffectStatePatternImpl<State>;

type EffectPatternShape = Readonly<Record<string, EffectStatePattern<unknown>>>;

function createPattern<State>(
    schema: Schema.Schema.AnyNoContext,
    stateSpace: FormalStateSpace,
): EffectStatePattern<State> {
    return new EffectStatePatternImpl(effectBackendToken, schema, stateSpace);
}

function unwrap(pattern: EffectStatePattern<unknown>): EffectStatePatternImpl<unknown> {
    if (!(pattern instanceof EffectStatePatternImpl) || pattern.backendToken !== effectBackendToken) {
        throw new TypeError("calibur-router/effect: 模式必须由 effectState 构造。");
    }
    return pattern;
}

function parseEffectStateSpace(ast: SchemaAST.AST, path = "schema"): FormalStateSpace {
    if (ast === Schema.JsonNumber.ast) {
        return formalDomain("number");
    }
    if (SchemaAST.isLiteral(ast)) {
        if (typeof ast.literal === "bigint") {
            throw new TypeError(`calibur-router/effect: ${path} 的 bigint literal 不在 JSON 状态子集中。`);
        }
        return formalUnit(ast.literal);
    }
    if (SchemaAST.isStringKeyword(ast)) {
        return formalDomain("string");
    }
    if (SchemaAST.isBooleanKeyword(ast)) {
        return formalDomain("boolean");
    }
    if (SchemaAST.isUnion(ast)) {
        return formalUnion(ast.types.map((branch, index) => parseEffectStateSpace(branch, `${path}[${index}]`)));
    }
    if (SchemaAST.isTypeLiteral(ast)) {
        if (ast.indexSignatures.length > 0) {
            throw new TypeError(`calibur-router/effect: ${path} 包含 index signature，当前形式化子集未定义该语义。`);
        }
        const properties: Record<string, FormalStateSpace> = {};
        for (const property of ast.propertySignatures) {
            if (typeof property.name !== "string") {
                throw new TypeError(`calibur-router/effect: ${path} 只支持字符串属性名。`);
            }
            if (property.isOptional) {
                throw new TypeError(`calibur-router/effect: ${path}.${property.name} 是 optional 字段。`);
            }
            properties[property.name] = parseEffectStateSpace(property.type, `${path}.${property.name}`);
        }
        return formalObject(properties);
    }
    throw new TypeError(
        `calibur-router/effect: ${path} 使用了不受支持的 ${ast._tag} Schema。`
    );
}

export const effectBackend = createFormalStateBackend<Schema.Schema.AnyNoContext>({
    name: "effect",
    token: effectBackendToken,
    validates: (schema, input) => Schema.is(schema)(input),
});

export const effectCalibur = createCaliburRouter(effectBackend);

export const effectState = {
    fromSchema<const NativeSchema extends Schema.Schema.AnyNoContext>(
        schema: NativeSchema,
    ): EffectStatePattern<Schema.Schema.Type<NativeSchema>> {
        return createPattern(schema, parseEffectStateSpace(schema.ast));
    },

    toSchema<State>(pattern: EffectStatePattern<State>): Schema.Schema<State, State, never> {
        return unwrap(pattern).schema as Schema.Schema<State, State, never>;
    },

    literal<const Value extends FormalUnit>(value: Value): EffectStatePattern<Value> {
        return createPattern(Schema.Literal(value), formalUnit(value));
    },

    enumerated<const First extends FormalUnit, const Rest extends readonly FormalUnit[]>(
        first: First,
        ...rest: Rest
    ): EffectStatePattern<First | Rest[number]> {
        const values: readonly [FormalUnit, ...FormalUnit[]] = [first, ...rest];
        return createPattern(Schema.Literal(...values), formalUnion(values.map(formalUnit)));
    },

    boolean(): EffectStatePattern<boolean> {
        return createPattern(Schema.Boolean, formalDomain("boolean"));
    },

    string(): EffectStatePattern<string> {
        return createPattern(Schema.String, formalDomain("string"));
    },

    number(): EffectStatePattern<number> {
        return createPattern(Schema.JsonNumber, formalDomain("number"));
    },

    object<const Shape extends EffectPatternShape>(
        shape: Shape,
    ): EffectStatePattern<PatternShapeState<Shape>> {
        const fields: Record<string, Schema.Schema.AnyNoContext> = {};
        const properties: Record<string, FormalStateSpace> = {};
        for (const [key, pattern] of Object.entries(shape)) {
            const unwrapped = unwrap(pattern);
            fields[key] = unwrapped.schema;
            properties[key] = unwrapped.stateSpace;
        }
        return createPattern(Schema.Struct(fields), formalObject(properties));
    },

    union<const Patterns extends readonly [EffectStatePattern<unknown>, ...EffectStatePattern<unknown>[]]>(
        ...patterns: Patterns
    ): EffectStatePattern<PatternState<Patterns[number]>> {
        const unwrapped = patterns.map(unwrap);
        return createPattern(
            Schema.Union(...unwrapped.map((pattern) => pattern.schema)),
            formalUnion(unwrapped.map((pattern) => pattern.stateSpace)),
        );
    },
};
