/** 用途：事件定义映射约束。使用范围：业务监听器适配；解耦评估：纯类型依赖，不引用具体事件总线。 */
import type { IEventDefines } from "../../util/lib/events/eventEmitter.types";
/** 用途：底层事件监听器签名。使用范围：guard 返回类型；解耦评估：纯类型依赖，不引用运行时 emitter。 */
import type { EventListener } from "../../util/lib/events/eventEmitter.types";
/** 用途：业务监听器签名。使用范围：适配输入；解耦评估：纯类型契约。 */
import type { MagiEventListener } from "./magiEventBus.types";
/** 用途：MAGI 事件名称。使用范围：适配泛型约束；解耦评估：纯类型契约。 */
import type { MagiEventName } from "./magiEventBus.types";

/** 将业务监听器转为 SafeEventEmitter 监听器签名。 */
export function toEmitterListener<T extends IEventDefines, K extends MagiEventName & keyof T>(
    listener: MagiEventListener<K>,
): EventListener<T, K> {
    return listener as EventListener<T, K>;
}
