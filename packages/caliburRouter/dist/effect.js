import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { createCaliburRouter } from "./core/matcher.js";
import { createFormalStateBackend, FormalStatePattern, } from "./formal/adapter.js";
import { formalDomain, formalObject, formalUnion, formalUnit, } from "./formal/stateSpace.js";
const effectBackendToken = {};
class EffectStatePatternImpl extends FormalStatePattern {
}
function createPattern(schema, stateSpace) {
    return new EffectStatePatternImpl(effectBackendToken, schema, stateSpace);
}
function unwrap(pattern) {
    if (!(pattern instanceof EffectStatePatternImpl) || pattern.backendToken !== effectBackendToken) {
        throw new TypeError("calibur-router/effect: 模式必须由 effectState 构造。");
    }
    return pattern;
}
function parseEffectStateSpace(ast, path = "schema") {
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
        const properties = {};
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
    throw new TypeError(`calibur-router/effect: ${path} 使用了不受支持的 ${ast._tag} Schema。`);
}
export const effectBackend = createFormalStateBackend({
    name: "effect",
    token: effectBackendToken,
    validates: (schema, input) => Schema.is(schema)(input),
});
export const effectCalibur = createCaliburRouter(effectBackend);
export const effectState = {
    fromSchema(schema) {
        return createPattern(schema, parseEffectStateSpace(schema.ast));
    },
    toSchema(pattern) {
        return unwrap(pattern).schema;
    },
    literal(value) {
        return createPattern(Schema.Literal(value), formalUnit(value));
    },
    enumerated(first, ...rest) {
        const values = [first, ...rest];
        return createPattern(Schema.Literal(...values), formalUnion(values.map(formalUnit)));
    },
    boolean() {
        return createPattern(Schema.Boolean, formalDomain("boolean"));
    },
    string() {
        return createPattern(Schema.String, formalDomain("string"));
    },
    number() {
        return createPattern(Schema.JsonNumber, formalDomain("number"));
    },
    object(shape) {
        const fields = {};
        const properties = {};
        for (const [key, pattern] of Object.entries(shape)) {
            const unwrapped = unwrap(pattern);
            fields[key] = unwrapped.schema;
            properties[key] = unwrapped.stateSpace;
        }
        return createPattern(Schema.Struct(fields), formalObject(properties));
    },
    union(...patterns) {
        const unwrapped = patterns.map(unwrap);
        return createPattern(Schema.Union(...unwrapped.map((pattern) => pattern.schema)), formalUnion(unwrapped.map((pattern) => pattern.stateSpace)));
    },
};
//# sourceMappingURL=effect.js.map