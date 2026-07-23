/** 用途：判断笔记本是否加密；使用范围：构造 zoomOut getDoc 参数；解耦评估：经同目录 imports 转发。 */
import { isEncryptedBox } from "./imports";
/** 用途：zoomOut 参数契约；使用范围：读取当前 notebook ID；解耦评估：同目录类型。 */
import type { ZoomOutOptions } from "./protyle.zoomOut.types";

/**
 * 构造 zoomOut 的 getDoc 参数。
 * 加密笔记本的读取必须显式携带 notebook，所有主加载和补偿请求复用此入口。
 */
/** @同步豁免: UI构建 - 请求发起前必须在同一调用栈内同步得到普通对象，改为异步会改变 fetchPost 参数契约。 */
export const createZoomOutGetDocParams = (options: ZoomOutOptions, params: IObject) => {
    if (!isEncryptedBox(options.protyle.notebookId)) {
        return params;
    }
    return {...params, notebook: options.protyle.notebookId};
};
