/** 用途：打开 AV 右键菜单；使用范围：gallery/util.ts 的卡片菜单动作；解耦评估：直接依赖 contextmenu 唯一实现，不加载 action 聚合入口。 */
import {avContextmenu} from "../action/contextmenu";
/** 用途：定位 Gallery 卡片祖先；使用范围：gallery/util.ts 的卡片菜单和字段编辑；解耦评估：直接依赖共享 DOM 查询实现。 */
import {hasClosestByClassName} from "../../../util/hasClosest";
/** 用途：提供 Gallery 字段显示文案；使用范围：gallery/util.ts 的字段切换 aria-label；解耦评估：直接依赖国际化环境。 */
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** 导出 Gallery 菜单能力。 */
export {avContextmenu};
/** 导出 Gallery 卡片查询能力。 */
export {hasClosestByClassName};
/** 导出 Gallery 国际化能力。 */
export {siyuanI18n};
