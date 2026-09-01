/** 用途：描述上传运行时端口注册表值。使用范围：读取 Symbol 全局槽前收窄未知值。解耦评估：守卫只依赖纯类型，不加载上传组合根。 */
import type {IUploadRuntimeEffects} from "./types";

/**
 * 作用：验证上传运行时端口是否同时包含文件和本地路径命令。
 * 意图：避免独立入口或 HMR 未装配时将无效全局值当作上传能力调用。
 * 调用时机：每个端口消费者准备启动上传前。
 * @同步豁免: 类型守卫 - 当前用户事件中必须立即判定上传能力可用性。
 */
export const isUploadRuntimeEffects = (value: unknown): value is IUploadRuntimeEffects => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const effects = value as Partial<IUploadRuntimeEffects>;
    return typeof effects.uploadFiles === "function" && typeof effects.uploadLocalFiles === "function";
};
