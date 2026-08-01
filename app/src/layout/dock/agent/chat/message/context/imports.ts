/** 用途：限制可见块引用数量；使用范围：编辑器上下文构建。 */
import {maxVisibleBlockIDs} from "../../AgentChat.runtime.types";
/** 导出块引用数量限制。 */
export {maxVisibleBlockIDs};

/** 用途：约束发送给 Agent 的编辑器上下文；使用范围：上下文构建。 */
import type {IEditorContext} from "../../../request/sse/agentSSE.types";
/** 导出编辑器上下文协议。 */
export type {IEditorContext};

/** 用途：约束编辑器公开表面；使用范围：编辑器选择与上下文读取。 */
import type {ProtyleDomain} from "../../../../../../protyle/protyle.types";
/** 导出编辑器领域接口。 */
export type {ProtyleDomain};

/** 用途：枚举当前布局编辑器；使用范围：桌面上下文捕获。 */
import {getAllEditor} from "../../../../../getAll";
/** 导出编辑器枚举函数。 */
export {getAllEditor};

/** 用途：判断移动端运行环境；使用范围：上下文来源选择。 */
import {isMobile} from "../../../../../../platform";
/** 导出移动端标识。 */
export {isMobile};
