/** 将已确认的 Promise 缓存转换为本次启动工厂的结果类型。 */
export const asStandaloneBootstrapPromise = <T>(value: Promise<unknown>): Promise<T> => value as Promise<T>;
