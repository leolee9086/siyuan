/** 用途：弹层定位需要统一读取全局尺寸常量；使用范围：`setPosition.ts` 的边界计算；解耦评估：布局常量属于全局配置边界，直接通过网关转发比调用方重复拼路径更稳定。 */
import { Constants } from "../../constants";
/** 用途：读取当前视口高度；使用范围：`setPosition.ts` 的垂直边界计算；解耦评估：窗口访问已在 environment 层封装，DOM 工具继续通过网关依赖即可。 */
import { getWindowHeight } from "../siyuanEnvironments/getWindowSize.environment";
/** 用途：读取当前视口宽度；使用范围：`setPosition.ts` 的水平边界计算；解耦评估：窗口访问已在 environment 层封装，DOM 工具继续通过网关依赖即可。 */
import { getWindowWidth } from "../siyuanEnvironments/getWindowSize.environment";
/** 用途：读取清空按钮的国际化文案；使用范围：`addClearButton.ts` 的 aria-label；解耦评估：文案服务属于全局依赖，直接复用环境封装比额外注入更清晰。 */
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";
/** 用途：查找最近的块级 DOM 节点；使用范围：`highlightById.ts` 的滚动定位；解耦评估：这是 Protyle 的标准定位能力，直接依赖比把查找逻辑散落在调用方更稳。 */
import { hasClosestBlock } from "../../protyle/util/hasClosest";
/** 用途：识别节点是否位于嵌入块内；使用范围：`highlightById.ts` 过滤重复命中的嵌入块结果；解耦评估：判定逻辑和 Protyle 结构强相关，不适合在 DOM 工具内重复实现。 */
import { isInEmbedBlock } from "../../protyle/util/hasClosest";
/** 用途：恢复编辑器 Range 焦点；使用范围：`highlightById.ts` 在插入临时标记后恢复用户选区；解耦评估：选区恢复必须复用现有编辑器工具，避免 DOM 工具自行维护焦点细节。 */
import { focusByRange } from "../../protyle/util/selection";
/** 用途：获取编辑器当前 Range；使用范围：`highlightById.ts` 在未显式传入节点时回退到当前光标块；解耦评估：选区读取依赖编辑器上下文，直接复用 Protyle 工具最可靠。 */
import { getEditorRange } from "../../protyle/util/selection";
/** 用途：安全读取浏览器 Selection；使用范围：`highlightById.ts` 滚动当前选区；解耦评估：窗口 API 已封装在 environment 层，继续经由网关访问能避免直接触碰全局对象。 */
import { getWindowSelection } from "../siyuanEnvironments/windowStandard.environment";

// 导出：弹层定位常量
export { Constants };
// 导出：视口高度读取器
export { getWindowHeight };
// 导出：视口宽度读取器
export { getWindowWidth };
// 导出：国际化文案访问器
export { siyuanI18n };
// 导出：最近块级节点查找器
export { hasClosestBlock };
// 导出：嵌入块判定工具
export { isInEmbedBlock };
// 导出：Range 焦点恢复工具
export { focusByRange };
// 导出：编辑器 Range 访问器
export { getEditorRange };
// 导出：浏览器 Selection 访问器
export { getWindowSelection };
