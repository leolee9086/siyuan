/** 用途：本地 Plugin 构造身份；使用范围：官方生态适配前的运行时校验；解耦评估：守卫是允许同时依赖具体实现与抽象契约的适配边界。 */
import {Plugin} from "./imports";
/** 用途：官方 Plugin 类型；使用范围：类型谓词目标；解耦评估：type-only 上游生态基线。 */
import type * as Siyuan from "siyuan";
/** 用途：已证明的完整本地插件表面；使用范围：守卫输入；解耦评估：不接受未经完整契约证明的对象。 */
import type {SiyuanPluginRuntimeContract} from "./SiyuanPluginRuntime.types";

/** @同步豁免: 类型守卫 */
/** 验证完整本地插件表面同时具有宿主唯一 Plugin 原型身份。 @显式返回类型原因：类型谓词必须显式声明以消除官方 class 的名义身份差异。 */
export const isSiyuanPlugin = (
    plugin: SiyuanPluginRuntimeContract,
): plugin is SiyuanPluginRuntimeContract & Siyuan.Plugin => plugin instanceof Plugin;
