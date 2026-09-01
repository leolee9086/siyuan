/** 用途：恢复块插入后的编辑器光标；使用范围：block/util.ts 的插入收尾；解耦评估：直接依赖选区实现，不加载 block 综合入口。 */
import {focusByWbr} from "../../protyle/util/selection";
/** 用途：读取当前编辑器选区；使用范围：block/util.ts 和插入目标定位；解耦评估：直接依赖选区实现。 */
import {getEditorRange} from "../../protyle/util/selection";
/** 用途：保存撤销焦点上下文；使用范围：block/util.ts 的插入事务；解耦评估：直接依赖选区实现。 */
import {getUndoFocusContext} from "../../protyle/util/selection";
/** 用途：刷新有序列表编号；使用范围：block/util.ts 的列表项插入；解耦评估：直接依赖列表排序实现，不加载列表综合入口。 */
import {updateListOrder} from "../../protyle/wysiwyg/list.updateOrder";
/** 用途：提交块事务；使用范围：block/util.ts 的 do/undo 操作；解耦评估：直接依赖事务提交实现。 */
import {transaction} from "../../protyle/wysiwyg/transaction/submit";
/** 用途：合并超级块事务；使用范围：block/util.ts 的列布局插入；解耦评估：直接依赖事务合并实现。 */
import {turnsIntoOneTransaction} from "../../protyle/wysiwyg/transaction/turns/container";
/** 用途：提交非列表块更新；使用范围：block/util.ts 的有序列表插入；解耦评估：直接依赖事务更新实现。 */
import {updateTransaction} from "../../protyle/wysiwyg/transaction/update";
/** 用途：滚动到新插入块；使用范围：block/util.ts 插入收尾；解耦评估：直接依赖 DOM 滚动实现。 */
import {scrollCenter} from "../../util/DOM/highlightById";
/** 用途：提供块导航动作和属性常量；使用范围：block/util.ts 的父子导航和插入；解耦评估：直接依赖稳定常量声明。 */
import {Constants} from "../../constants";
/** 用途：获取兄弟块 ID；使用范围：block/util.ts 的父子导航请求；解耦评估：直接依赖网络请求实现。 */
import {fetchPost} from "../../util/network/fetch";
/** 用途：生成块类型显示名称；使用范围：block/util.ts 的语言映射；解耦评估：直接依赖国际化环境，不加载配置综合入口。 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：创建列表项元素；使用范围：util.createNewBlockElement 的列表分支；解耦评估：直接依赖列表元素实现。 */
import {genListItemElement} from "../../protyle/wysiwyg/list";
/** 用途：读取前置兄弟块；使用范围：util.createNewBlockElement 的标题插入判断；解耦评估：直接依赖块结构查询实现。 */
import {getPreviousBlockSibling} from "../../protyle/wysiwyg/getBlock";
/** 用途：提升顶层块；使用范围：util.getInsertTargetBlock 的锚点规范化；解耦评估：直接依赖块结构实现。 */
import {getTopAloneElement} from "../../protyle/wysiwyg/getBlock";
/** 用途：清理选中 UI；使用范围：util.getInsertTargetBlock 的多选分支；解耦评估：直接依赖编辑器 UI 实现。 */
import {hideElements} from "../../protyle/ui/hideElements";
/** 用途：查找列表祖先；使用范围：util.getInsertTargetBlock 的列表回退；解耦评估：直接依赖 DOM 查询实现。 */
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
/** 用途：定位最近块元素；使用范围：util.getInsertTargetBlock 的光标目标查询；解耦评估：直接依赖块查询实现。 */
import {hasClosestBlock} from "../../protyle/util/hasClosest";

/** 导出选区光标能力。 */
export {focusByWbr};
/** 导出选区读取能力。 */
export {getEditorRange};
/** 导出撤销焦点上下文能力。 */
export {getUndoFocusContext};
/** 导出列表排序能力。 */
export {updateListOrder};
/** 导出事务提交能力。 */
export {transaction};
/** 导出事务合并能力。 */
export {turnsIntoOneTransaction};
/** 导出事务更新能力。 */
export {updateTransaction};
/** 导出滚动能力。 */
export {scrollCenter};
/** 导出块常量。 */
export {Constants};
/** 导出网络请求能力。 */
export {fetchPost};
/** 导出国际化环境。 */
export {siyuanI18n};
/** 导出列表项元素能力。 */
export {genListItemElement};
/** 导出前置兄弟查询能力。 */
export {getPreviousBlockSibling};
/** 导出顶层块查询能力。 */
export {getTopAloneElement};
/** 导出编辑器 UI 清理能力。 */
export {hideElements};
/** 导出祖先查询能力。 */
export {hasClosestByClassName};
/** 导出块查询能力。 */
export {hasClosestBlock};
