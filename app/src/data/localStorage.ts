import { Constants } from "../constants";
import { setStorageVal } from "../protyle/util/compatibility";

/**
 * 保存自定义AI动作到本地存储
 *
 * @param ctx - 上下文对象，包含保存前后的回调函数
 * @param ctx.onBeforeSave - 保存前的回调函数（可选）
 * @param ctx.onAfterSave - 保存后的回调函数（可选）
 * @param req - 请求数据对象，包含要保存的AI动作信息
 * @param req.name - AI动作的名称
 * @param req.customAction - AI动作的自定义内容
 *
 * @example
 * ```typescript
 * saveCustomAIAction(
 *   {
 *     onBeforeSave: () => console.log('开始保存'),
 *     onAfterSave: () => console.log('保存完成')
 *   },
 *   {
 *     name: '翻译助手',
 *     customAction: '将文本翻译成英文'
 *   }
 * );
 * ```
 */
export const saveCustomAIAction = (
    ctx: {
        onBeforeSave?: Function,
        onAfterSave?: Function
    },
    req: {
        name: string,
        customAction: string
    },
) => {
    ctx.onBeforeSave && ctx.onBeforeSave();
    window.siyuan.storage[Constants.LOCAL_AI].push(req);
    setStorageVal(
        Constants.LOCAL_AI,
        window.siyuan.storage[Constants.LOCAL_AI],
        () => {
 ctx.onAfterSave(); 
}
    );
};