/** 用途：EventData 事件数据类型。使用范围：MAGI 事件监听器签名转换。解耦评估：类型导入，不涉及运行时耦合。 */
import type {
    EventData,
} from "../../util/lib/events/eventEmitter.types";
/** 用途：MagiEventName 事件名称联合类型。使用范围：监听器签名的泛型约束。解耦评估：类型导入，不涉及运行时耦合。 */
import type { MagiEventName } from "./magiEventBus.types";
/** 用途：MagiEventPayloadMap 事件载荷映射类型。使用范围：监听器签名的泛型约束。解耦评估：类型导入，不涉及运行时耦合。 */
import type { MagiEventPayloadMap } from "./magiEventBus.types";

/** 将业务监听器转为 SafeEventEmitter 监听器签名。 */
export function toEmitterListener<K extends MagiEventName>(
    listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
): (payload: EventData<typeof import("./magiEventBus").magiEventDefines, K>) => void | Promise<void> {
    return listener as (payload: EventData<typeof import("./magiEventBus").magiEventDefines, K>) => void | Promise<void>;
}
