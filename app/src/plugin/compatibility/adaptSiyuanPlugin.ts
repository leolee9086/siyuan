/** 用途：官方插件类型；使用范围：插件进入 AppFacade 与笔记内插件状态前的生态边界；解耦评估：type-only 官方基线。 */
import type {Plugin} from "siyuan";
/** 用途：官方完整表面在本地身份下的兼容证明；使用范围：适配器唯一输入；解耦评估：只允许通过已证明的完整表面。 */
import type {SiyuanPluginRuntimeContract} from "./SiyuanPluginRuntime.types";
/** 用途：本地 Plugin 身份守卫；使用范围：官方类型返回前的确定性校验；解耦评估：直达唯一兼容守卫。 */
import {isSiyuanPlugin} from "./SiyuanPlugin.guard";

/**
 * 将已通过完整公共表面证明的本地插件映射为官方 Plugin 类型并保持对象身份。
 * 官方声明引用带 private 身份的 App/Files/Tab 等 class，而 npm 包不含可实例化运行时；断言仅封闭这一名义身份差异。
 * @同步豁免: 生命周期
 * @显式返回类型原因：适配器必须固定输出官方 Plugin，而不是泄露本地交叉类型。
 */
export const adaptSiyuanPlugin = (plugin: SiyuanPluginRuntimeContract): Plugin => {
    if (!isSiyuanPlugin(plugin)) {
        throw new TypeError("SiYuan plugin adapter requires the local Plugin runtime identity");
    }
    return plugin;
};
