/** 用途：布局树完整领域类型。使用范围：布局实例查询的输入与输出。 */
import type {LayoutDomain} from "../layout.types";
/** 用途：页签完整领域根。使用范围：布局查询叶节点。 */
import type {LayoutTab} from "../layout.types";
/** 用途：窗口完整领域根。使用范围：布局查询分支节点。 */
import type {LayoutWindow} from "../layout.types";

/**
 * 用途：表示布局树查询能够返回的完整领域实例。
 * 使用场景：递归按 ID 定位布局容器、窗口或页签。
 * 关联类型：由完整 LayoutDomain、LayoutWindow 和 LayoutTab 组成，不引入具体 class。
 */
export type LayoutInstance = LayoutDomain | LayoutWindow | LayoutTab;
