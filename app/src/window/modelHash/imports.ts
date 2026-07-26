/** 用途：窗口模式判断。使用范围：模型 hash 仅用于独立窗口；解耦评估：稳定平台事实。 */
import {isWindow} from "../../util/platform/functions";
/** 导出窗口模式判断。 */
export {isWindow};

/** 用途：hash 分隔常量。使用范围：保持窗口恢复协议；解耦评估：稳定共享常量。 */
import {Constants} from "../../constants";
/** 导出协议常量。 */
export {Constants};

/** 用途：写入地址 hash。使用范围：模型序列化最终副作用；解耦评估：稳定浏览器环境适配。 */
import {setLocationHash} from "../../util/siyuanEnvironments/windowLocation.environment";
/** 导出 hash 写入。 */
export {setLocationHash};

/** 用途：读取当前布局。使用范围：收集中心布局页签；解耦评估：无参公共 API 的既有环境语义。 */
import {getSiyuanLayout} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出布局读取。 */
export {getSiyuanLayout};

/** 用途：稳定布局遍历。使用范围：按窗口顺序收集页签；解耦评估：纯算法不加载具体布局 class。 */
import {collectLayoutTabs} from "../../layout/traversal/collectLayout";
/** 导出页签遍历。 */
export {collectLayoutTabs};

/** 用途：页签遍历领域类型。使用范围：hash 序列化输入；解耦评估：纯类型依赖。 */
import type {ILayoutTraversalTab} from "../../layout/traversal/layoutTraversal.types";
/** 导出页签遍历类型。 */
export type {ILayoutTraversalTab};
