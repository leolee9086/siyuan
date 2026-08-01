/** 从插件执行结果中提取字符串结果和错误，忽略宿主返回的其它字段。 */
export function readPluginActionOutcome(value: unknown) {
    if (!value || typeof value !== "object") {
        return {result: "", error: ""};
    }
    const result = Reflect.get(value, "result");
    const error = Reflect.get(value, "error");
    return {
        result: typeof result === "string" ? result : "",
        error: typeof error === "string" ? error : "",
    };
}
