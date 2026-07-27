/** 用途：上游插件生态类型；使用范围：完整官方 Plugin 表面的运行时身份重绑定；解耦评估：type-only 官方基线。 */
import type * as Siyuan from "siyuan";
/** 用途：本地完整应用外观；使用范围：替换官方 App 的宿主身份；解耦评估：直达抽象声明。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 用途：本地 Custom 实现；使用范围：仅在兼容性证明中校验官方 Custom 身份；解耦评估：该文件是允许同时依赖声明与实现的适配检查边界。 */
import type {Custom} from "../../layout/dock/custom/Custom";
/** 用途：本地 Files 实现；使用范围：仅在兼容性证明中校验官方 Files 身份；解耦评估：该文件是允许同时依赖声明与实现的适配检查边界。 */
import type {Files} from "../../layout/dock/Files";
/** 用途：本地 Tab 实现；使用范围：仅在兼容性证明中校验官方 Tab 身份；解耦评估：该文件是允许同时依赖声明与实现的适配检查边界。 */
import type {Tab} from "../../layout/Tab";
/** 用途：本地 MobileCustom 实现；使用范围：仅在兼容性证明中校验官方移动自定义模型身份；解耦评估：适配检查边界。 */
import type {MobileCustom} from "../../mobile/dock/MobileCustom";
/** 用途：本地 EventBus 实现；使用范围：替换官方事件总线运行时身份；解耦评估：适配检查边界。 */
import type {EventBus} from "../EventBus";
/** 用途：本地 Protyle 实现；使用范围：仅在兼容性证明中校验官方编辑器身份；解耦评估：适配检查边界。 */
import type {Protyle} from "../../protyle";
/** 用途：严格类型等价工具；使用范围：阻止条件类型误匹配广义对象；解耦评估：纯类型基础能力。 */
import type {StrictEqual} from "../../util/types/LooksLike.types";

/** 将参数元组中的官方运行时身份逐项投影为本地等价身份。 */
type RebindTuple<T extends readonly unknown[]> = {
    [K in keyof T]: RebindSiyuanRuntime<T[K]>;
};

/**
 * 保留上游公开契约的完整结构，只将宿主实际传入的运行时 class 身份重绑定到本地实现。
 * 该投影仅用于官方类型包与本地实现的适配/契约边界，不删减 Plugin 公共成员。
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
            : T extends (...args: infer Args) => infer Result
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
