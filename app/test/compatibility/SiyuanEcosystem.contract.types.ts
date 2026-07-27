import type * as Siyuan from "siyuan";
import type {AppFacade} from "../../src/app/AppFacade.types";
import type {Custom} from "../../src/layout/dock/custom/Custom";
import type {Files} from "../../src/layout/dock/Files";
import type {Tab} from "../../src/layout/Tab";
import type {MobileCustom} from "../../src/mobile/dock/MobileCustom";
import type {EventBus} from "../../src/plugin/EventBus";
import type {Protyle} from "../../src/protyle";
import type {StrictEqual} from "../../src/util/types/LooksLike.types";

type RebindTuple<T extends readonly unknown[]> = {
    [K in keyof T]: RebindSiyuanRuntime<T[K]>;
};

/**
 * 保留上游公开契约的完整结构，只将宿主实际传入的运行时 class 身份重绑定到本地实现。
 * 该投影仅存在于契约测试层，不参与生产类型图，也不删减官方 Plugin 的公共成员。
 */
export type RebindSiyuanRuntime<T> =
    T extends Siyuan.App ? AppFacade :
    T extends Siyuan.EventBus ? EventBus :
    T extends Siyuan.Custom ? Custom :
    T extends Siyuan.MobileCustom ? MobileCustom :
    T extends Siyuan.Files ? Files :
    T extends Siyuan.Protyle ? Protyle :
    T extends Siyuan.Tab ? Tab :
    StrictEqual<T, Siyuan.IProtyle> extends true ? IProtyle :
    StrictEqual<T, Siyuan.IProtyleOptions> extends true ? IProtyleOptions :
    StrictEqual<T, Siyuan.ICommand> extends true ? ICommand :
    StrictEqual<T, Siyuan.IPluginDockTab> extends true ? IPluginDockTab :
    T extends Promise<infer Result> ? Promise<RebindSiyuanRuntime<Result>> :
    T extends Node | Event | EventTarget | Date | RegExp ? T :
    T extends ReadonlyMap<infer Key, infer Value>
        ? ReadonlyMap<RebindSiyuanRuntime<Key>, RebindSiyuanRuntime<Value>>
        : T extends ReadonlySet<infer Item>
            ? ReadonlySet<RebindSiyuanRuntime<Item>>
            :
    T extends (...args: infer Args) => infer Result
        ? (...args: RebindTuple<Args>) => RebindSiyuanRuntime<Result>
        : T extends readonly (infer Item)[]
            ? RebindSiyuanRuntime<Item>[]
            : T extends object
                ? {[K in keyof T]: RebindSiyuanRuntime<T[K]>}
                : T;

/** 官方 Plugin 全部公共成员在本地运行时身份下的兼容契约。 */
export type SiyuanPluginRuntimeContract = {
    [K in keyof Siyuan.Plugin]: RebindSiyuanRuntime<Siyuan.Plugin[K]>;
};
