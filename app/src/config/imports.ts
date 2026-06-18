/** 用途：DOM 元素类型守卫。使用范围：config 模块 DOM 操作。解耦评估：通过 imports.ts 转发。 */
import { isHTMLElement, isHTMLInputElement, isInputEvent } from "../util/DOM/element.guard";
/** 导出 isHTMLElement，供 config 模块使用 */
export { isHTMLElement };
/** 导出 isHTMLInputElement，供 config 模块使用 */
export { isHTMLInputElement };
/** 导出 isInputEvent，供 config 模块使用 */
export { isInputEvent };

/** 用途：HTTP POST 请求封装。使用范围：config 模块 kernel API 通信。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "../util/network/fetch";
/** 导出 fetchSyncPost，供 config 模块使用 */
export { fetchSyncPost };
/** 用途：HTTP POST 请求封装（原始响应）。使用范围：config 模块文件读取。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPostRaw } from "../util/network/fetch";
/** 导出 fetchSyncPostRaw，供 config 模块使用 */
export { fetchSyncPostRaw };
/** 用途：UUID 生成。使用范围：config 模块创建 Profile ID。解耦评估：通过 imports.ts 转发。 */
import { genUUID } from "../util/platform/genID";
/** 导出 genUUID，供 config 模块使用 */
export { genUUID };
