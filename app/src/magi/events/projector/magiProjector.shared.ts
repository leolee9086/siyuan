/**
 * MAGI 投影共享操作。
 *
 * 用途：提供幂等、排序、贤者查找和 Trinity 原始监控投影。
 * 使用范围：reply、vote、tool 与主投影器模块。
 */

/** 用途：原始事件公共字段。使用范围：Trinity 监控投影。解耦评估：通过子目录网关隔离上层事件定义。 */
import type { MagiEventBase } from "./imports";
/** 用途：消息存储契约。使用范围：排序更新与监控消息。解耦评估：通过子目录网关隔离视图模型路径。 */
import type { MagiMessage } from "./imports";
/** 用途：投影幂等状态。使用范围：全部共享写入操作。解耦评估：通过子目录网关隔离主投影类型。 */
import type { MagiProjectorRuntimeState } from "./imports";
/** 用途：投影初始化目标。使用范围：运行时状态创建。解耦评估：通过子目录网关隔离主投影类型。 */
import type { MagiProjectorTarget } from "./imports";
/** 用途：贤者响应式容器。使用范围：查找与三贤人过滤。解耦评估：通过子目录网关隔离 composable 实现。 */
import type { WrappedSeel } from "./imports";

/** 为事件构造稳定消息 ID，避免重复落盘。 */
/** @同步豁免: 性能考虑 - 事件处理热路径只进行确定性字符串拼接，异步化会破坏同一事件内的原子更新。 */
export function buildProjectedMessageId(eventId: string, suffix: string) {
    return `${eventId}:${suffix}`;
}

/** 拷贝消息对象，避免共享引用导致跨区域联动。 */
/** @同步豁免: 性能考虑 - 响应式数组写入前必须立即获得独立快照，函数不涉及外部资源。 */
export function cloneMessage(message: MagiMessage) {
    return {
        ...message,
        ...(message.meta ? { meta: { ...message.meta } } : {}),
    };
}

/** 判断贤者是否属于三贤人卡片，而不是 Trinity 监控宿主。 */
function isSageSeelName(name: string) {
    return name === "MELCHIOR" || name === "BALTHASAR" || name === "CASPER";
}

/** 返回三贤人（排除 TRINITY）。 */
/** @同步豁免: 性能考虑 - 事件投影必须在当前分发周期同步取得目标卡片，数据集固定且很小。 */
export function listSageSeels(seels: WrappedSeel[]) {
    const sages: WrappedSeel[] = [];
    for (const seel of seels) {
        // 只有三张贤人卡片接收语义活动，Trinity 保留为原始监控宿主。
        if (isSageSeelName(normalizeSeelIdentity(seel.config.name))) {
            sages.push(seel);
        }
    }
    return sages;
}

/** 返回运行时监控宿主节点（当前仍挂在 TRINITY-00 面板）。 */
function findMonitorHostSeel(seels: WrappedSeel[]) {
    return seels.find((seel) => normalizeSeelIdentity(seel.config.name) === "TRINITY") ?? null;
}

/** 深拷贝事件载荷，确保消息元数据可稳定序列化。 */
function cloneEventPayloadForMeta(event: MagiEventBase) {
    try {
        const cloned = JSON.parse(JSON.stringify(event));
        if (typeof cloned === "object" && cloned !== null) {
            return Object.fromEntries(Object.entries(cloned));
        }
    } catch (error) {
        console.warn("[magi-projector] clone event payload failed", error);
    }
    return {};
}

/** 按 ID 更新或插入消息，按 timestamp 与 seq 排序。 */
/** @同步豁免: 生命周期 - 事件总线分发期间必须原子更新响应式数组，避免后续事件观察到中间状态。 */
export function upsertMessage(messages: MagiMessage[], incoming: MagiMessage) {
    const index = messages.findIndex((message) => message.id === incoming.id);
    // 流式或工具生命周期命中稳定 ID 时原位覆盖，保持用户阅读位置不变。
    if (index >= 0) {
        messages.splice(index, 1, cloneMessage(incoming));
        return;
    }

    const incomingSeq = typeof incoming.meta?.seq === "number" ? incoming.meta.seq : undefined;
    let left = 0;
    let right = messages.length;
    while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const midMessage = messages[mid];
        if (!midMessage) {
            break;
        }
        // 中间消息更早时继续搜索右半区。
        if (midMessage.timestamp < incoming.timestamp) {
            left = mid + 1;
            continue;
        }
        // 中间消息更晚时继续搜索左半区。
        if (midMessage.timestamp > incoming.timestamp) {
            right = mid;
            continue;
        }
        const midSeq = typeof midMessage.meta?.seq === "number" ? midMessage.meta.seq : undefined;
        // 时间戳相同时使用后端序号维持单一贤者流内的确定顺序。
        if (midSeq !== undefined && incomingSeq !== undefined && midSeq < incomingSeq) {
            left = mid + 1;
            continue;
        }
        right = mid;
    }
    messages.splice(left, 0, cloneMessage(incoming));
}

/** 按内部名称查找贤者实例。 */
/** @同步豁免: 性能考虑 - 名称规范化位于事件处理热路径且只执行纯字符串运算。 */
export function normalizeSeelIdentity(value: unknown) {
    if (typeof value !== "string") {
        return "";
    }
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
        return "";
    }
    if (normalized.includes("MELCHIOR")) {
        return "MELCHIOR";
    }
    if (normalized.includes("BALTHASAR") || normalized.includes("BALTHAZAR")) {
        return "BALTHASAR";
    }
    if (normalized.includes("CASPER")) {
        return "CASPER";
    }
    if (normalized.includes("TRINITY")) {
        return "TRINITY";
    }
    return normalized.replace(/[^A-Z0-9]/g, "");
}

/** 按后端名称、显示名称和规范化名称查找贤者。 */
/** @同步豁免: 性能考虑 - 当前事件必须同步绑定到唯一响应式贤者容器，异步查找没有收益。 */
export function findSeelByName(
    seels: WrappedSeel[],
    seelName: unknown,
    displayName?: unknown,
) {
    const exact = typeof seelName === "string" && seelName
        ? seels.find((seel) => seel.config.name === seelName)
        : undefined;
    if (exact) {
        return exact;
    }
    const candidates = [seelName, displayName]
        .map((candidate) => normalizeSeelIdentity(candidate))
        .filter((candidate) => candidate.length > 0);
    if (candidates.length === 0) {
        return null;
    }
    return seels.find((seel) => {
        const nameKey = normalizeSeelIdentity(seel.config.name);
        const displayKey = normalizeSeelIdentity(seel.config.displayName);
        return candidates.includes(nameKey) || candidates.includes(displayKey);
    }) ?? null;
}

/** 将原始事件保留到 Trinity 诊断流；贤人卡片只接收语义活动。 */
/** @同步豁免: 生命周期 - 原始诊断事件与语义活动必须在同一事件总线分发周期内按序落盘。 */
export function projectRawEventToMonitor(
    state: MagiProjectorRuntimeState,
    eventType: string,
    event: MagiEventBase,
) {
    const monitorHost = findMonitorHostSeel(state.target.seels);
    if (!monitorHost) {
        return;
    }
    upsertMessage(monitorHost.messages, {
        id: buildProjectedMessageId(event.eventId, `event-${eventType}-MONITOR`),
        type: "event",
        content: eventType,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "raw-event",
            eventType,
            eventPayload: cloneEventPayloadForMeta(event),
            eventId: event.eventId,
            seq: event.seq,
            roundId: event.roundId,
            targetSeel: monitorHost.config.name,
            monitorScope: "magi-monitor",
        },
    });
}

/** 读取非空字符串，空值返回 undefined。 */
/** @同步豁免: 性能考虑 - 事件字段收窄是无副作用的常量时间操作。 */
export function readNonEmptyString(value: unknown) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/** 读取布尔值，非布尔时返回 undefined。 */
/** @同步豁免: 性能考虑 - 事件字段收窄是无副作用的常量时间操作。 */
export function readBoolean(value: unknown) {
    return typeof value === "boolean" ? value : undefined;
}

/** 读取对象记录，供事件扩展字段安全访问。 */
/** @同步豁免: 性能考虑 - 事件字段收窄必须在当前投影分支内立即完成。 */
export function readRecord(value: unknown) {
    return typeof value === "object" && value !== null
        ? Object.fromEntries(Object.entries(value))
        : undefined;
}

/** 创建投影运行时状态。 */
/** @同步豁免: 生命周期 - bindMagiProjector 初始化时必须立即建立该绑定独享的幂等集合。 */
export function createRuntimeState(target: MagiProjectorTarget) {
    return {
        processedEventIds: new Set<string>(),
        target,
    };
}

/** 判断事件是否应进入投影流程。 */
/** @同步豁免: 生命周期 - 检查和登记必须是同一同步临界区，避免重复事件并发穿透。 */
export function shouldProcessEvent(state: MagiProjectorRuntimeState, eventId: string) {
    if (state.processedEventIds.has(eventId)) {
        return false;
    }
    state.processedEventIds.add(eventId);
    const maxEventIds = 10000;
    // 长会话达到上限时清空历史幂等键，限制监控状态的常驻内存。
    if (state.processedEventIds.size > maxEventIds) {
        state.processedEventIds.clear();
    }
    return true;
}
