/** 用途：转换全局启动 Promise 的结果类型。使用范围：独立入口并发初始化。解耦评估：守卫只处理共享缓存协议，不依赖具体入口。 */
import {asStandaloneBootstrapPromise} from "./bootstrap.guard";

/** 在 window 上按键缓存独立入口启动 Promise，合并同一入口的并发初始化。 */
export const bootstrapStandaloneOnce = async <T>(key: string, factory: () => Promise<T>) => {
    const cached = Reflect.get(window, key);
    // 同一页面已开始或完成该入口初始化时，所有调用方复用同一结果与失败状态。
    if (cached instanceof Promise) {
        return await asStandaloneBootstrapPromise<T>(cached);
    }
    const promise = factory();
    Reflect.set(window, key, promise);
    return await promise;
};
