/** 用途：读取上传运行时注册表。使用范围：编辑器、AV 和 base64 上传调用。解耦评估：环境模块持有跨调用状态，端口自身无上传实现。 */
import {getRegisteredUploadRuntimeEffects} from "./registry.environment";
/** 用途：写入上传运行时注册表。使用范围：upload/index.ts 组合根初始化。解耦评估：环境模块持有跨调用状态，端口自身无上传实现。 */
import {registerUploadRuntimeEffects} from "./registry.environment";
/** 用途：描述上传运行时能力和参数。使用范围：端口注册与 no-op 回退。解耦评估：纯类型不加载上传实现。 */
import type {IUploadRuntimeEffects} from "./types";
import type {TUploadFiles} from "./types";
import type {TUploadLocalFiles} from "./types";

/**
 * 作用：为未装配上传宿主提供显式失败回退。
 * 意图：独立 Protyle 入口可以加载调用方而不静默丢失上传请求。
 * 调用时机：端口尚未由 upload/index.ts 注册时。
 * @同步豁免: 生命周期 - 必须在当前用户事件中同步返回失败结果，避免悬挂调用方。
 */
const unavailableUploadFiles: TUploadFiles = (_protyle, _files, _element, _successCB, completeCB) => {
    completeCB?.(false);
};

/**
 * 作用：为未装配上传宿主提供本地路径失败回退。
 * 意图：保持拖拽和本地粘贴调用可结束，而不是等待不存在的上传任务。
 * 调用时机：端口尚未由 upload/index.ts 注册时。
 * @同步豁免: 生命周期 - 当前事件必须立即通知调用方任务不可用。
 */
const unavailableUploadLocalFiles: TUploadLocalFiles = (
    _files,
    _protyle,
    _isUpload,
    _options,
    _successCB,
    completeCB,
) => {
    completeCB?.(false);
};

/**
 * 作用：读取完整上传运行时能力或失败回退。
 * 意图：低层编辑模块只依赖稳定协议，不引入 upload/index.ts 的 AV/事务依赖。
 * 调用时机：文件、base64 或本地路径上传开始前。
 * @同步豁免: 生命周期 - 当前调用栈需要立即获得能力引用。
 */
export const getUploadRuntimeEffects = (): IUploadRuntimeEffects =>
    getRegisteredUploadRuntimeEffects() || {
        uploadFiles: unavailableUploadFiles,
        uploadLocalFiles: unavailableUploadLocalFiles,
    };

/**
 * 作用：向低层调用方发布完整上传实现。
 * 意图：只由上传组合根注册高层任务管线，避免反向导入。
 * 调用时机：upload/index.ts 模块完成命令定义后。
 * @同步豁免: 生命周期 - 首个上传事件前必须同步完成端口装配。
 */
export const setUploadRuntimeEffects = (effects: IUploadRuntimeEffects) => {
    registerUploadRuntimeEffects(effects);
};
