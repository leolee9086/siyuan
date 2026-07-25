import {
    formalDomain,
    formalObject,
    formalUnion,
    formalUnit,
    type FormalStateSpace,
    type FormalUnit,
} from "./stateSpace.js";

const annotationKeys = new Set(["$schema", "$id", "$comment", "title", "description", "examples"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFormalUnit(value: unknown): value is FormalUnit {
    return value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value));
}

function assertOnlyKeys(schema: Record<string, unknown>, structuralKeys: readonly string[], path: string): void {
    const allowed = new Set([...annotationKeys, ...structuralKeys]);
    const unsupported = Object.keys(schema).filter((key) => !allowed.has(key));
    if (unsupported.length > 0) {
        throw new TypeError(
            `calibur-router: ${path} 包含不可形式化的 JSON Schema 关键字: ${unsupported.join(", ")}。`
        );
    }
}

function parseConst(schema: Record<string, unknown>, path: string): FormalStateSpace {
    assertOnlyKeys(schema, ["type", "const"], path);
    if (!isFormalUnit(schema.const)) {
        throw new TypeError(`calibur-router: ${path}.const 必须是有限 JSON literal。`);
    }
    return formalUnit(schema.const);
}

function parseEnum(schema: Record<string, unknown>, path: string): FormalStateSpace {
    assertOnlyKeys(schema, ["type", "enum"], path);
    if (!Array.isArray(schema.enum) || schema.enum.length === 0 || !schema.enum.every(isFormalUnit)) {
        throw new TypeError(`calibur-router: ${path}.enum 必须是非空有限 JSON literal 数组。`);
    }
    return formalUnion(schema.enum.map(formalUnit));
}

function parseObject(schema: Record<string, unknown>, path: string): FormalStateSpace {
    assertOnlyKeys(schema, ["type", "properties", "required", "additionalProperties"], path);
    if (!isRecord(schema.properties)) {
        throw new TypeError(`calibur-router: ${path}.properties 必须是对象。`);
    }
    if (!Array.isArray(schema.required) || !schema.required.every((key) => typeof key === "string")) {
        throw new TypeError(`calibur-router: ${path} 只支持全部字段必需的对象。`);
    }
    const propertyKeys = Object.keys(schema.properties);
    const requiredKeys = new Set(schema.required);
    if (propertyKeys.some((key) => !requiredKeys.has(key)) || requiredKeys.size !== propertyKeys.length) {
        throw new TypeError(`calibur-router: ${path} 包含 optional 字段，当前形式化子集未定义其差集语义。`);
    }
    if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== "boolean") {
        throw new TypeError(`calibur-router: ${path}.additionalProperties 只接受布尔值。`);
    }

    const properties: Record<string, FormalStateSpace> = {};
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
        properties[key] = parseFormalJsonSchema(propertySchema, `${path}.properties.${key}`);
    }
    return formalObject(properties);
}

export function parseFormalJsonSchema(schema: unknown, path = "schema"): FormalStateSpace {
    if (!isRecord(schema)) {
        throw new TypeError(`calibur-router: ${path} 必须是 JSON Schema 对象。`);
    }
    if ("const" in schema) {
        return parseConst(schema, path);
    }
    if ("enum" in schema) {
        return parseEnum(schema, path);
    }
    if ("anyOf" in schema) {
        assertOnlyKeys(schema, ["anyOf"], path);
        if (!Array.isArray(schema.anyOf) || schema.anyOf.length === 0) {
            throw new TypeError(`calibur-router: ${path}.anyOf 必须是非空数组。`);
        }
        return formalUnion(schema.anyOf.map((branch, index) =>
            parseFormalJsonSchema(branch, `${path}.anyOf[${index}]`)
        ));
    }

    switch (schema.type) {
        case "string":
            assertOnlyKeys(schema, ["type"], path);
            return formalDomain("string");
        case "number":
            assertOnlyKeys(schema, ["type"], path);
            return formalDomain("number");
        case "boolean":
            assertOnlyKeys(schema, ["type"], path);
            return formalDomain("boolean");
        case "null":
            assertOnlyKeys(schema, ["type"], path);
            return formalUnit(null);
        case "object":
            return parseObject(schema, path);
        default:
            throw new TypeError(`calibur-router: ${path} 的 Schema 类型不在形式化子集中。`);
    }
}
