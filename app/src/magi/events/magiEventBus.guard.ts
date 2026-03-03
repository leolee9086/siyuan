import type {
    EventData,
    EventDataWithMeta,
} from "../../util/lib/events/eventEmitter.types";
import type {
    MagiEventMetaStrippedPayload,
    MagiEventName,
    MagiEventPayloadMap,
} from "./magiEventBus.types";

/** 将去元字段载荷升级为完整事件数据。 */
export function toMagiEventData<K extends MagiEventName>(
    payload: MagiEventMetaStrippedPayload<K>,
    nextMeta: () => { eventId: string; seq: number },
): EventDataWithMeta<typeof import("./magiEventBus").magiEventDefines, K> {
    return {
        ...structuredClone(payload),
        ...nextMeta(),
    } as EventDataWithMeta<typeof import("./magiEventBus").magiEventDefines, K>;
}

/** 将业务监听器转为 SafeEventEmitter 监听器签名。 */
export function toEmitterListener<K extends MagiEventName>(
    listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
): (payload: EventData<typeof import("./magiEventBus").magiEventDefines, K>) => void | Promise<void> {
    return listener as (payload: EventData<typeof import("./magiEventBus").magiEventDefines, K>) => void | Promise<void>;
}
