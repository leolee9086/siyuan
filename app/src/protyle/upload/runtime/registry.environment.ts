/** 用途：验证上传运行时端口。使用范围：读取 Symbol 注册表前收窄未知值。解耦评估：守卫位于同一低层端口子域，不加载上传组合根。 */
import {isUploadRuntimeEffects} from "./registry.guard";
/** 用途：描述要写入上传运行时注册表的能力。使用范围：端口生命周期注册。解耦评估：纯类型依赖，不加载上传实现。 */
import type {IUploadRuntimeEffects} from "./types";

const uploadRuntimeEffectsKey = Symbol.for("sforge.protyle.upload.runtimeEffects");

/**
 * 作用：读取当前注册的上传运行时能力。
 * 意图：AV 和 base64 低层模块不反向加载上传聚合模块。
 * 调用时机：调用方准备启动上传任务前。
 * @同步豁免: 生命周期 - 用户事件中的上传命令必须在当前调用栈取得稳定能力。
 */
export const getRegisteredUploadRuntimeEffects = () => {
    const effects = Reflect.get(globalThis, uploadRuntimeEffectsKey);
    if (!isUploadRuntimeEffects(effects)) {
        return;
    }
    return effects;
};

/**
 * 作用：注册上传运行时能力。
 * 意图：upload/index.ts 继续所有权地保存完整任务管线，而低层调用方仅消费端口。
 * 调用时机：上传组合根模块完成全部命令定义后。
 * @同步豁免: 生命周期 - 任一编辑器上传事件前必须同步固定函数引用。
 */
export const registerUploadRuntimeEffects = (effects: IUploadRuntimeEffects) => {
    const didRegister = Reflect.set(globalThis, uploadRuntimeEffectsKey, effects);
    if (!didRegister) {
        throw new Error("Unable to register upload runtime effects");
    }
};
