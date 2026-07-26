/** 用途：布局树完整领域根。使用范围：查询算法输入。解耦评估：纯类型依赖，不加载具体布局 class。 */
import type {LayoutDomain, LayoutWindow} from "../layout.types";
/** 导出查询算法使用的完整布局领域根。 */
export type {LayoutDomain};
/** 导出活动窗口查询使用的完整窗口领域根。 */
export type {LayoutWindow};

/** 用途：布局窗口遍历唯一实现。使用范围：活动窗口选择。解耦评估：查询与遍历同属无状态布局领域算法，参数传递只会复制既有布局遍历职责。 */
import {collectLayoutWindows} from "../traversal/collectLayout";
/** 导出窗口遍历实现。 */
export {collectLayoutWindows};

/** 用途：安全读取当前布局。使用范围：按 ID 查询的缺省中心布局。解耦评估：显式 layout 参数已支持外部注入，环境读取仅保留旧 API 的无参调用语义。 */
import {getSafeSiyuanLayout} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出安全布局读取。 */
export {getSafeSiyuanLayout};
