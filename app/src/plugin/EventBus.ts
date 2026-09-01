/**
 * 事件总线类，提供基于DOM的发布订阅机制
 * 
 * 用于插件系统和应用内部的事件通信，支持类型安全的事件监听和触发
 */
/** 用途：绑定上游插件事件名与载荷映射；使用范围：EventBus 全部公开方法；解耦评估：type-only 生态契约，不加载上游运行时。 */
import type {IEventBusMap, TEventBus} from "siyuan";

/** 单个监听器的注册记录；wrapped 是真正挂载到 EventTarget 的回调，注销时用它精确移除。 */
interface IEventBusListener {
    listener: (event: CustomEvent<any>) => unknown;
    wrapped: EventListener;
    once: boolean;
}

/** 安全派发结果：汇总默认行为是否被阻止、首个同步错误与是否存在异步监听器，供上传拦截等调用方判定。 */
export interface IEventBusSafeEmitResult {
    defaultPrevented: boolean;
    error?: unknown;
    hasAsyncListener: boolean;
}

/* @允许类: EventBus 是插件公开 API 中已经发布的运行时身份，第三方插件和应用核心都直接构造该类型，
 * 并可能依赖 instanceof、构造器引用以及原型方法身份，因此改写为对象工厂会破坏既有插件兼容性。该对象必须在
 * 多个 on、once、off、emit 调用之间长期持有同一个私有 EventTarget，负责监听器注册、一次性监听、移除和同步
 * 派发的完整生命周期；闭包工厂会改变公开构造方式、方法原型和序列化观察结果，也会迫使所有插件调用点迁移。
 * 这里保留 class 并非为了复用 UI 编排：插件菜单构建已经迁出本模块，EventBus 不再导入 Plugin、MenuItem、
 * subMenu 或全局菜单实现，只保留事件通道领域本身。泛型 DetailType 继续约束每个实例的消息载荷，TEventBus
 * 继续约束事件名，DOM EventTarget 则保证浏览器原生的监听顺序、once 语义、取消语义和 removeEventListener
 * 身份匹配。Kernel、Plugin 与 App 共享这一稳定领域身份，但 EventBus 不反向依赖这些具体实现，从而形成单向
 * 依赖。后续若公开 API 出现大版本迁移窗口，可以另行设计函数式事件通道并提供明确迁移期；在当前版本直接替换
 * 会造成真实行为与生态兼容回归，所以保留该 class 是必要的领域建模和兼容边界，而不是可由普通对象字面量等价
 * 取代的状态容器。事件目标还必须随实例长期存活，不能由每次调用临时创建，否则监听器身份和注销语义都会失真。 */
export class EventBus {
    private eventTarget: EventTarget;
    private listeners = new Map<TEventBus, Map<(event: CustomEvent<any>) => unknown, IEventBusListener>>();
    private safeDispatches = new WeakMap<Event, IEventBusSafeEmitResult>();

    /**
     * 构造事件总线实例
     *
     * 作用：创建一个事件目标节点用于事件监听和触发
     * 意图：提供轻量级的事件通信机制，避免直接耦合
     * 调用时机：插件初始化时或需要独立事件通道时
     *
     * @同步豁免: 生命周期 - 构造函数必须是同步的
     */
    constructor(name: string | Document = "", eventTarget?: EventTarget) {
        // 显式注入的事件目标优先，便于宿主环境复用既有 EventTarget 并隔离测试观察点。
        if (eventTarget) {
            this.eventTarget = eventTarget;
            return;
        }
        // 当传入document时，直接使用document作为事件目标，用于全局事件
        if (name === document) {
            this.eventTarget = document;
            return;
        }
        // 否则创建一个注释节点作为事件目标，避免污染DOM结构
        this.eventTarget = document.appendChild(document.createComment(typeof name === "string" ? name : ""));
    }

    private addListener(type: TEventBus, listener: (event: CustomEvent<any>) => unknown, once: boolean) {
        let typeListeners = this.listeners.get(type);
        if (!typeListeners) {
            typeListeners = new Map();
            this.listeners.set(type, typeListeners);
        }
        // 同一监听器重复注册时直接忽略，保持与原生 addEventListener 一致的幂等语义。
        if (typeListeners.has(listener)) {
            return;
        }
        const wrapped: EventListener = (event) => {
            if (once) {
                this.off(type, listener);
            }
            const safeResult = this.safeDispatches.get(event);
            try {
                // 以事件目标作为 this 调用监听器，保持与原生 DOM 监听一致的绑定行为。
                const result = listener.call(this.eventTarget, event as CustomEvent<any>);
                if (safeResult && result && typeof result.then === "function") {
                    safeResult.hasAsyncListener = true;
                    void Promise.resolve(result).catch(listenerError => console.error(listenerError));
                }
                return result;
            } catch (error) {
                if (!safeResult) {
                    throw error;
                }
                // 安全派发模式下记录错误并阻断后续监听器，由 emitWithErrors 汇总返回给调用方。
                safeResult.error = error;
                event.stopImmediatePropagation();
            }
        };
        typeListeners.set(listener, {listener, wrapped, once});
        this.eventTarget.addEventListener(type, wrapped);
    }

    /**
     * 注册事件监听器
     *
     * 作用：监听指定类型的事件
     * 意图：允许订阅者响应事件
     * 调用时机：需要监听某个事件时
     *
     * @同步豁免: 生命周期 - addEventListener是同步API
     */
    on<K extends TEventBus, D = IEventBusMap[K]>(
        type: K,
        listener: (event: CustomEvent<D>) => unknown,
    ) {
        this.addListener(type, listener, false);
    }

    /**
     * 注册一次性事件监听器
     *
     * 作用：监听指定类型的事件，触发一次后自动移除
     * 意图：避免手动管理监听器生命周期
     * 调用时机：只需要响应一次事件时
     *
     * @同步豁免: 生命周期 - addEventListener是同步API
     */
    once<K extends TEventBus, D = IEventBusMap[K]>(
        type: K,
        listener: (event: CustomEvent<D>) => unknown,
    ) {
        this.addListener(type, listener, true);
    }

    /**
     * 移除事件监听器
     *
     * 作用：取消对指定事件的监听
     * 意图：避免内存泄漏和不必要的事件处理
     * 调用时机：不再需要监听事件时（如组件销毁）
     *
     * @同步豁免: 生命周期 - removeEventListener是同步API
     */
    off<K extends TEventBus, D = IEventBusMap[K]>(
        type: K,
        listener: (event: CustomEvent<D>) => unknown,
    ) {
        const typeListeners = this.listeners.get(type);
        const registered = typeListeners?.get(listener);
        if (!registered) {
            return;
        }
        this.eventTarget.removeEventListener(type, registered.wrapped);
        typeListeners.delete(listener);
        if (typeListeners.size === 0) {
            this.listeners.delete(type);
        }
    }

    /**
     * 触发事件
     * 
     * 作用：向所有监听器广播事件
     * 意图：通知订阅者某个事件发生
     * 调用时机：需要通知其他模块某个状态变化或操作发生时
     * 
     * @同步豁免: 生命周期 - dispatchEvent是同步API
     */
    emit<K extends TEventBus, D = IEventBusMap[K]>(type: K, detail?: D) {
        return this.eventTarget.dispatchEvent(new CustomEvent(type, { detail, cancelable: true }));
    }

    /**
     * 安全派发事件
     *
     * 作用：广播事件并汇总派发过程中的错误与状态，不向调用方抛出异常
     * 意图：让资源上传等关键路径能依据监听器的拦截结果决定后续流程
     * 调用时机：需要感知监听器是否阻止默认行为、抛出错误或含异步处理时
     *
     * @同步豁免: 生命周期 - dispatchEvent是同步API
     */
    emitWithErrors<K extends TEventBus, D = IEventBusMap[K]>(type: K, detail?: D): IEventBusSafeEmitResult {
        const event = new CustomEvent(type, { detail, cancelable: true });
        const result: IEventBusSafeEmitResult = {defaultPrevented: false, hasAsyncListener: false};
        this.safeDispatches.set(event, result);
        try {
            this.eventTarget.dispatchEvent(event);
        } finally {
            this.safeDispatches.delete(event);
        }
        result.defaultPrevented = event.defaultPrevented;
        return result;
    }
}

/** 插件菜单构建由独立工厂模块承载，这里转发导出以同时兼容来自本模块的既有导入路径。 */
export {emitOpenMenu} from "./menu/emitOpenMenu.factory";
