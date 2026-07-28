import * as z from "zod";
import { createCaliburRouter } from "./core/matcher.js";
import { createFormalStateBackend, FormalStatePattern, } from "./formal/adapter.js";
import { formalDomain, formalObject, formalUnion, formalUnit, } from "./formal/stateSpace.js";
import { parseFormalJsonSchema } from "./formal/jsonSchema.js";
const zodBackendToken = {};
class ZodStatePatternImpl extends FormalStatePattern {
}
function createPattern(schema, stateSpace) {
    return new ZodStatePatternImpl(zodBackendToken, schema, stateSpace);
}
function unwrap(pattern) {
    if (!(pattern instanceof ZodStatePatternImpl) || pattern.backendToken !== zodBackendToken) {
        throw new TypeError("calibur-router/zod: 模式必须由 zodState 构造。");
    }
    return pattern;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isZodSchema(value) {
    return isRecord(value) &&
        typeof value.type === "string" &&
        isRecord(value.def) &&
        typeof value.safeParse === "function";
}
function isZodObject(schema) {
    return schema.type === "object" && "shape" in schema && isRecord(schema.shape);
}
function isZodUnion(schema) {
    return schema.type === "union" && "options" in schema && Array.isArray(schema.options);
}
function assertSupportedZodSchema(schema, path = "schema") {
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
            schema.options.forEach((option, index) => assertSupportedZodSchema(option, `${path}[${index}]`));
            return;
        }
        default:
            throw new TypeError(`calibur-router/zod: ${path} 使用了不受支持的 ${schema.type} Schema。`);
    }
}
export const zodBackend = createFormalStateBackend({
    name: "zod",
    token: zodBackendToken,
    validates: (schema, input) => schema.safeParse(input).success,
});
export const zodCalibur = createCaliburRouter(zodBackend);
export const zodState = {
    fromSchema(schema) {
        assertSupportedZodSchema(schema);
        const jsonSchema = z.toJSONSchema(schema, { io: "input", unrepresentable: "throw" });
        return createPattern(schema, parseFormalJsonSchema(jsonSchema));
    },
    toSchema(pattern) {
        return unwrap(pattern).schema;
    },
    literal(value) {
        return createPattern(z.literal(value), formalUnit(value));
    },
    enumerated(first, ...rest) {
        const values = [first, ...rest];
        const schemas = values.map((value) => z.literal(value));
        let schema = schemas[0];
        for (let index = 1; index < schemas.length; index++) {
            schema = schema.or(schemas[index]);
        }
        return createPattern(schema, formalUnion(values.map(formalUnit)));
    },
    boolean() {
        return createPattern(z.boolean(), formalDomain("boolean"));
    },
    string() {
        return createPattern(z.string(), formalDomain("string"));
    },
    number() {
        return createPattern(z.number(), formalDomain("number"));
    },
    object(shape) {
        const schemaShape = {};
        const properties = {};
        for (const [key, pattern] of Object.entries(shape)) {
            const unwrapped = unwrap(pattern);
            schemaShape[key] = unwrapped.schema;
            properties[key] = unwrapped.stateSpace;
        }
        return createPattern(z.object(schemaShape), formalObject(properties));
    },
    union(...patterns) {
        const unwrapped = patterns.map(unwrap);
        let schema = unwrapped[0].schema;
        for (let index = 1; index < unwrapped.length; index++) {
            schema = schema.or(unwrapped[index].schema);
        }
        return createPattern(schema, formalUnion(unwrapped.map((pattern) => pattern.stateSpace)));
    },
};
//# sourceMappingURL=zod.js.map