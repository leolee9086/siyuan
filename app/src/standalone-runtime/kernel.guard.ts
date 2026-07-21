/** 用途：约束共享 Kernel 响应。使用范围：独立入口网络边界。解耦评估：纯类型依赖，不产生运行时耦合。 */
import type {IStandaloneKernelResponse} from "./kernel.types";

/** 校验未知 JSON 并转换为思源核心标准响应。 */
export const parseStandaloneKernelResponse = <T>(value: unknown, path: string): IStandaloneKernelResponse<T> => {
    if (!value || typeof value !== "object" || typeof Reflect.get(value, "code") !== "number" ||
        typeof Reflect.get(value, "msg") !== "string" || !("data" in value)) {
        throw new Error(`Invalid Kernel response: ${path}`);
    }
    return value as IStandaloneKernelResponse<T>;
};

/** 将已由语言接口返回的 JSON 转换为项目语言字典。 */
export const asStandaloneLanguage = (value: unknown): IObject => value as IObject;
