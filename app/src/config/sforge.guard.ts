/**
 * sforge.guard.ts - SForge 类型守卫
 * 
 * 封装类型断言，符合架构规范
 */

/** 用途：带 SForge 的全局对象接口。使用范围：类型守卫中将 globalThis 断言为 IGlobalWithSForge。解耦评估：同目录类型文件，类型导入。 */
import type { IGlobalWithSForge } from "./sforge.types";

/**
 * 将 globalThis 转换为带 SForge 接口的类型
 * 
 * 在 .guard.ts 中允许使用 as 断言
 */
export function asGlobalWithSForge(global: typeof globalThis): IGlobalWithSForge {
    return global as unknown as IGlobalWithSForge;
}

/** 用途：样式刷子处理器类型。使用范围：从注册表提取刷子处理器时的类型转换。解耦评估：父目录类型导入，纯类型引用。 */
import type { IStyleBrushHandlers } from "../registry/TriggerRegistry.types";

/**
 * 将值转换为 IStyleBrushHandlers
 */
export function asStyleBrushHandlers(val: unknown): IStyleBrushHandlers | undefined {
    return val as IStyleBrushHandlers | undefined;
}

/** 用途：Model 处理器接口。使用范围：类型守卫运行时校验注册表值。解耦评估：同目录类型文件，类型导入。 */
import type { IModelHandlers } from "./sforge.types";
/** 用途：openMobileFileById 函数签名。使用范围：类型守卫运行时校验注册表值。解耦评估：同目录类型文件，类型导入。 */
import type { TOpenMobileFileById } from "./sforge.types";
/** 用途：Profile 类型。使用范围：配置文件解析类型守卫。解耦评估：同目录类型文件，类型导入。 */
import type { Profile } from "./profile.types";
/** 用途：NamespaceState 类型。使用范围：配置文件解析类型守卫。解耦评估：同目录类型文件，类型导入。 */
import type { NamespaceState } from "./profile.types";

/**
 * 类型守卫：检查值是否为 IModelHandlers
 *
 * 意图：运行时校验从 SForge 注册表取出的值确实包含 Model 所需的三个处理器函数
 * 调用时机：Model.registry.ts 中 getModelHandlers 读取注册表后
 */
export function isModelHandlers(val: unknown): val is IModelHandlers {
    if (!val || typeof val !== "object") {
        return false;
    }
    const obj = val as Record<string, unknown>;
    return typeof obj.processMessage === "function"
        && typeof obj.kernelError === "function"
        && typeof obj.reloadSync === "function";
}

/**
 * 类型守卫：检查值是否为 TOpenMobileFileById
 *
 * 意图：运行时校验从 SForge 注册表取出的值确实是 openMobileFileById 函数
 * 调用时机：plugin/API.ts 中通过注册表获取 openMobileFileById 时
 */
export function isOpenMobileFileById(val: unknown): val is TOpenMobileFileById {
    return typeof val === "function";
}

/**
 * 类型守卫：检测对象是否包含 code 属性（API 响应类型守卫）
 *
 * 意图：区分 SiYuan kernel API 的成功响应与错误响应
 * 调用时机：解析 kernel API 返回的未知结构时
 */
export function hasCodeProperty(obj: object): obj is { code: unknown } {
    return "code" in obj;
}

/**
 * 用途：将 unknown 值断言为 Profile 类型
 * 使用范围：loadProfile 方法中解析 API 返回的文件内容
 */
export function asProfile<T>(val: unknown): Profile<T> {
    return val as Profile<T>;
}

/**
 * 用途：将 unknown 值断言为 NamespaceState 类型
 * 使用范围：getActiveProfileId 方法中解析 API 返回的文件内容
 */
export function asNamespaceState(val: unknown): NamespaceState {
    return val as NamespaceState;
}
