/**
 * 来自vue内部逻辑
 */

export function assertType(value: unknown, type: any) {
  const expectedType = getType(type);
  if (expectedType === "null") {
    return {
      valid: value === null,
      expectedType
    };
  }
  if (isSimpleType(expectedType)) {
    const t = typeof value;
    const valid = t === expectedType.toLowerCase() || (t === "object" && value instanceof type);
    return {
      valid,
      expectedType
    };
  }
  if (expectedType === "Object") {
    return {
      valid: isObject(value),
      expectedType
    };
  }
  if (expectedType === "Array") {
    return {
      valid: isArray(value),
      expectedType
    };
  }
  return {
    valid: value instanceof type,
    expectedType
  };
}

export function getType(ctor: any): string {
  if (ctor === null) {
    return "null";
  }
  if (typeof ctor === "function") {
    return ctor.name || "";
  }
  if (typeof ctor === "object") {
    const name = ctor.constructor && ctor.constructor.name;
    return name || "";
  }
  return "";
}

function makeMap(str: string) {
  const map = /* @__PURE__ */ Object.create(null);
  for (const key of str.split(",")) {
map[key] = 1;
}
  return (val: string) => val in map;
}

const isSimpleType = /* @__PURE__ */ makeMap(
  "String,Number,Boolean,Function,Symbol,BigInt"
);

const isArray = Array.isArray;

const isMap = (val: unknown) => toTypeString(val) === "[object Map]";
const isSet = (val: unknown) => toTypeString(val) === "[object Set]";
const isDate = (val: unknown) => toTypeString(val) === "[object Date]";
const isRegExp = (val: unknown) => toTypeString(val) === "[object RegExp]";
const isFunction = (val: unknown): val is (...args: any[]) => any => typeof val === "function";
const isString = (val: unknown): val is string => typeof val === "string";
const isSymbol = (val: unknown): val is symbol => typeof val === "symbol";
const isObject = (val: unknown): val is Record<any, any> => val !== null && typeof val === "object";
const isPromise = (val: unknown) => {
  return (isObject(val) || isFunction(val)) && isFunction((val as any).then) && isFunction((val as any).catch);
};
const objectToString = Object.prototype.toString;
const toTypeString = (value: unknown) => objectToString.call(value);
