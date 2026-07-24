/** 用途：Editor 模型具体实现；使用范围：保持既有公共入口和 class 身份；解耦评估：入口仅公开模型子域，不再消费 Editor 全域网关。 */
import {Editor} from "./model/Editor";

/** 保持既有 `editor/index.ts` 公共导出路径与运行时 class 身份。 */
export {Editor};
