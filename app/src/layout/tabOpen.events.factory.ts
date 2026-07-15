import {z} from "../util/lib/events/imports";
import {SafeEventEmitter} from "../util/lib/events/eventEmitter";

/** 普通 Tab 请求的运行时定义，确保外部宿主收到的载荷不会漂移。 */
const tabOpenEventDefines = {
    "tab-open-requested": {
        tabId: z.string().min(1),
        title: z.string(),
        dockType: z.string().min(1),
        source: z.union([z.literal("agent-dock"), z.literal("dock-menu")]),
    },
};

// 普通 Tab 能力的跨模块单例事件总线。它只保存可退订监听器，不持有 Tab/DOM 引用。
const tabOpenEvents = new SafeEventEmitter(tabOpenEventDefines, {
    runtimeCheck: true,
    validationFailure: "throw",
});

export {tabOpenEvents};
