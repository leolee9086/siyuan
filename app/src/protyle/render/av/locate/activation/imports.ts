/** 用途：读取定位注册状态；使用范围：排队与重试；解耦评估：直达状态真实所有者。 */
import {getAVLocateRegistry} from "../state/state";
/** 导出定位注册状态读取。 */
export {getAVLocateRegistry};

/** 用途：读取已渲染 AV 数据；使用范围：本地定位复用；解耦评估：直达状态真实所有者。 */
import {getRenderedAVData} from "../state/state";
/** 导出已渲染数据读取。 */
export {getRenderedAVData};

/** 用途：写入当前定位请求；使用范围：激活阶段；解耦评估：直达状态真实所有者。 */
import {setAVLocateRequest} from "../state/state";
/** 导出定位请求写入。 */
export {setAVLocateRequest};

/** 用途：清除旧定位高亮；使用范围：新定位激活前；解耦评估：直达状态生命周期所有者。 */
import {clearLocatedHighlight} from "../state/state";
/** 导出高亮清理。 */
export {clearLocatedHighlight};

/** 用途：激活阶段完整领域类型；使用范围：公开 API 与重试状态；解耦评估：纯类型直达声明。 */
import type {AVLocateActivationContext, AVQueuedLocateRequest, AVQueuedLocateRetryState, IAVLocateRequest} from "../locate.types";
/** 导出激活上下文。 */
export type {AVLocateActivationContext};
/** 导出排队请求状态。 */
export type {AVQueuedLocateRequest};
/** 导出排队重试状态。 */
export type {AVQueuedLocateRetryState};
/** 导出定位请求。 */
export type {IAVLocateRequest};
