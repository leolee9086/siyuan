/** 用途：应用常量定义。使用范围：localStorage 本地存储键名。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";
/** 用途：本地存储写入工具。使用范围：localStorage 持久化 AI 动作。解耦评估：通过 imports.ts 转发。 */
import { setStorageVal } from "./imports";

/**
 * 保存自定义AI动作到本地存储
 *
 * @param ctx - 上下文对象，包含保存前后的回调函数
 * @param ctx.onBeforeSave - 保存前的回调函数（可选）
 * @param ctx.onAfterSave - 保存后的回调函数（可选）
 * @param req - 请求数据对象，包含要保存的AI动作信息
 * @param req.name - AI动作的名称
 * @param req.customAction - AI动作的自定义内容
 * @同步豁免: UI构建 — 同步读写 localStorage，无异步依赖
 */
export const saveCustomAIAction = (
    ctx: {
        onBeforeSave?: () => void,
        onAfterSave?: () => void
    },
    req: {
        name: string,
        customAction: string
    },
) => {
    const win = document.defaultView;
    if (!win) {
        return;
    }
    const siyuan = win.siyuan;
    if (!siyuan) {
        return;
    }
    const storage = siyuan.storage;
    if (!storage) {
        return;
    }

    if (ctx.onBeforeSave) {
        ctx.onBeforeSave();
    }
    const storageKey = Constants.LOCAL_AI;
    const storageData = storage[storageKey];
    storageData.push(req);
    setStorageVal(
        Constants.LOCAL_AI,
        storageData,
        () => ctx.onAfterSave?.()
    );
};