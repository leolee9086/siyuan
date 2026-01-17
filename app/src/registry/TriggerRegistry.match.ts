import { IGlobalContext, ITriggerRegistration } from "./TriggerRegistry.types";
import { isValidTriggerRegistration } from "./TriggerRegistry.guard";

/**
 * 尝试匹配单个触发器
 */
async function 尝试匹配触发器(
    registration: ITriggerRegistration,
    context: IGlobalContext,
    timeout: number
): Promise<ITriggerRegistration | null> {
    if (!registration.match) {
        // 无 match 函数，默认匹配
        return registration;
    }

    try {
        // 带超时的匹配
        const result = await Promise.race([
            Promise.resolve(registration.match(context)),
            new Promise<false>((_, reject) =>
                setTimeout(() => reject(new Error("match timeout")), timeout)
            )
        ]);

        if (result) {
            return registration;
        }
    } catch {
        // 超时或匹配失败，跳过
        console.debug(`[TriggerRegistry] 触发器 ${registration.type} 匹配超时或失败`);
    }
    return null;
}

/**
 * 匹配当前上下文可用的触发器
 * 
 * @param context 全局上下文
 * @param 注册表 触发器注册表 Map
 * @param options 匹配选项
 * @returns 匹配的触发器列表
 */
export async function 执行匹配触发器(
    context: IGlobalContext,
    注册表: Map<string, ITriggerRegistration>,
    options?: {
        /** 超时时间(ms)，默认 100ms */
        timeout?: number;
        /** 是否使用 AbortController */
        abortSignal?: AbortSignal;
    }
): Promise<ITriggerRegistration[]> {
    const timeout = options?.timeout ?? 100;

    // @内联回调
    const matchPromises = Array.from(注册表.values()).map(
        (reg) => 尝试匹配触发器(reg, context, timeout)
    );

    const results = await Promise.all(matchPromises);
    return results.filter(isValidTriggerRegistration);
}
