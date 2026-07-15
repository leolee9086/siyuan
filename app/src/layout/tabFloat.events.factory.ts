import {z} from "../util/lib/events/imports";
import {SafeEventEmitter} from "../util/lib/events/eventEmitter";

/**
 * 页签浮窗事件的运行时定义。该定义只描述跨边界传递的稳定字段，不携带 Tab/DOM 实例，
 * 因而宿主可以通过 ID 或 Port 获取运行时对象；事件载荷在发射前统一经过 Zod 校验。
 */
const tabFloatEventDefines = {
    "tab-open-as-dialog-requested": {
        tabId: z.string().min(1),
        title: z.string(),
        source: z.literal("tab-menu"),
    },
};

/**
 * 事件总线必须跨多个订阅者共享状态，不能在每次请求时重新创建；它只保存监听器函数，
 * 不持有 Tab 或 DOM 引用。生命周期由订阅者返回的取消函数管理，宿主销毁时应主动退订。
 */
// @允许模块级变量: 这是布局宿主事件边界的单例发射器，仅保存可退订的监听器，不保存业务模型或 DOM；若改为每次调用创建实例会丢失跨模块订阅关系，无法满足独立宿主在菜单点击前注册能力的契约。
const tabFloatEvents = new SafeEventEmitter(tabFloatEventDefines, {
    runtimeCheck: true,
    validationFailure: "throw",
});

/** 导出共享的页签浮窗事件发射器，供 Port 层订阅和发射请求。 */
/** 导出共享的页签浮窗事件发射器，供 Port 层订阅和发射请求。 */
export {tabFloatEvents};
