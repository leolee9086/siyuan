import type {
    EventData,
} from "../../util/lib/events/eventEmitter.types";
import type {
    MagiEventName,
    MagiEventPayloadMap,
} from "./magiEventBus.types";

/** 将业务监听器转为 SafeEventEmitter 监听器签名。 */
export function toEmitterListener<K extends MagiEventName>(
    listener: (payload: MagiEventPayloadMap[K]) => void | Promise<void>,
): (payload: EventData<typeof import("./magiEventBus").magiEventDefines, K>) => void | Promise<void> {
    return listener as (payload: EventData<typeof import("./magiEventBus").magiEventDefines, K>) => void | Promise<void>;
}
