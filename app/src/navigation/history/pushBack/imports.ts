/** 用途：后退栈容量协议。使用范围：写入导航历史；解耦评估：直达无状态协议常量。 */
import {Constants} from "../../../constants";
/** 导出后退栈容量协议。 */
export {Constants};

/** 用途：从选区节点定位块。使用范围：写入导航历史；解耦评估：直达唯一 DOM 查询实现。 */
import {hasClosestBlock} from "../../../protyle/util/hasClosest";
/** 导出块祖先查询。 */
export {hasClosestBlock};

/** 用途：取得块的可编辑元素。使用范围：计算历史光标；解耦评估：直达唯一 Protyle DOM 实现。 */
import {getContenteditableElement} from "../../../protyle/wysiwyg/getBlock";
/** 导出可编辑元素查询。 */
export {getContenteditableElement};

/** 用途：计算选区偏移。使用范围：写入导航历史；解耦评估：直达唯一 Selection 算法。 */
import {getSelectionOffset} from "../../../protyle/util/selection";
/** 导出选区偏移算法。 */
export {getSelectionOffset};

/** 用途：统一导航状态注册表。使用范围：桌面后退/前进栈；解耦评估：直达同领域唯一可枚举状态所有者。 */
import {getNavigationHistoryState} from "../NavigationHistoryRegistry";
/** 导出导航状态访问。 */
export {getNavigationHistoryState};
