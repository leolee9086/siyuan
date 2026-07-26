/** 用途：恢复编辑器 Range 焦点；使用范围：`helpers/highlightById.ts` 在插入临时节点后恢复选区；解耦评估：选区恢复依赖现有编辑器工具，通过 helpers 网关转发最稳妥。 */
import { focusByRange } from "../../../protyle/util/selection";
/** 用途：读取编辑器当前 Range；使用范围：`helpers/highlightById.ts` 在未显式传入节点时回退到当前光标块；解耦评估：选区读取与 Protyle 结构强相关，不适合在 helper 内重写。 */
import { getEditorRange } from "../../../protyle/util/selection";
/** 用途：读取浏览器 Selection；使用范围：`helpers/highlightById.ts` 处理当前选区滚动；解耦评估：窗口 API 已通过 environment 封装，通过 helpers 网关访问可避免直接触碰全局对象。 */
import { getWindowSelection } from "../../siyuanEnvironments/windowStandard.environment";
/** 用途：识别最近的块级 DOM 节点；使用范围：`helpers/highlightById.ts` 的定位回退逻辑；解耦评估：块查找依赖 Protyle 结构，直接复用已有工具最可靠。 */
import { hasClosestBlock } from "../../../protyle/util/hasClosest";
/** 用途：识别嵌入块中的重复命中节点；使用范围：`helpers/highlightById.ts` 的块查找过滤逻辑；解耦评估：判定逻辑与 Protyle DOM 约定耦合，直接复用更稳。 */
import { isInEmbedBlock } from "../../../protyle/util/hasClosest";
/** 用途：读取编辑器配置；使用范围：`helpers/highlightById.ts` 计算顶部保留空间；解耦评估：配置读取已抽象到 environment 层，通过网关复用即可。 */
import { getSiyuanConfig } from "../../../layout/util.environment";
/** 用途：执行纯 DOM 目标滚动；使用范围：高亮 helper 明确目标后的滚动分支；解耦评估：直达滚动唯一实现。 */
import {scrollTargetIntoView} from "../scrollTarget";

// 导出：Range 焦点恢复工具
export { focusByRange };
// 导出：编辑器 Range 访问器
export { getEditorRange };
// 导出：浏览器 Selection 访问器
export { getWindowSelection };
// 导出：最近块级节点查找器
export { hasClosestBlock };
// 导出：嵌入块判定工具
export { isInEmbedBlock };
// 导出：思源配置访问器
export { getSiyuanConfig };
// 导出：纯 DOM 目标滚动原语
export {scrollTargetIntoView};
