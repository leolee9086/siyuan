/** 用途：描述思源核心标准响应；使用范围：独立入口 bootstrap；解耦评估：属于内核协议边界，应保留在入口适配层。 */
interface IKernelResponse<T> {
    code: number;
    data: T;
    msg: string;
}

/** 将未知 JSON 转换为思源核心响应，后续阶段由 KernelPort 的结构校验替代。 */
export const asKernelResponse = <T>(value: unknown): IKernelResponse<T> => value as IKernelResponse<T>;

/** 将已按标签和 ID 查询的元素转换为脚本元素。 */
export const asScriptElement = (value: HTMLElement | null): HTMLScriptElement | null => value as HTMLScriptElement | null;

/** 将已按标签和 ID 查询的元素转换为样式链接元素。 */
export const asLinkElement = (value: HTMLElement | null): HTMLLinkElement | null => value as HTMLLinkElement | null;

/** 将语言接口返回的未知 JSON 转换为现有国际化字典。 */
export const asLanguageDictionary = (value: unknown): IObject => value as IObject;

/** 判断全局缓存是否为独立运行时启动 Promise。 */
export const isStandaloneRuntimePromise = (value: unknown): value is Promise<IStandaloneSiyuanRuntime> => value instanceof Promise;
/** 用途：标注独立入口运行时 Promise；使用范围：跨调用 bootstrap 缓存守卫；解耦评估：仅用于模块生命周期去重。 */
import type {IStandaloneSiyuanRuntime} from "./standalone.types";
