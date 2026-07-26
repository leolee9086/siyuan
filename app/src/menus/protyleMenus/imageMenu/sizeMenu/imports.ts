/**
 * 用途：集中管理 sizeMenu 子目录依赖。
 * 使用范围：宽高子菜单的 common/width/height/types 文件。
 * 解耦评估：通过子目录转发层隔离父目录路径变化，降低跨层耦合。
 */

/**
 * 用途：读取流程时间工具。
 * 使用范围：尺寸事务提交时写入 updated 字段。
 * 解耦评估：直接依赖包入口，避免 imports 网关多跳转发。
 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供 sizeMenu 子模块复用 */
export { dayjs };

/**
 * 用途：图片尺寸兼容处理。
 * 使用范围：宽高输入和滑杆拖动时同步容器尺寸。
 * 解耦评估：兼容逻辑在基础层统一，子模块仅消费能力。
 */
import { img3115 } from "../../../../boot/compatibleVersion";
/** 导出 img3115 供 sizeMenu 子模块复用 */
export { img3115 };

/**
 * 用途：恢复块焦点。
 * 使用范围：尺寸提交后关闭菜单并回到编辑区。
 * 解耦评估：聚焦能力在工具层封装，子模块无需直接操作 Range。
 */
import { focusBlock } from "../../../../protyle/util/selection";
/** 导出 focusBlock 供 sizeMenu 子模块复用 */
export { focusBlock };

/**
 * 用途：提交事务。
 * 使用范围：宽高修改后的持久化更新。
 * 解耦评估：事务入口统一，子模块只传前后 HTML。
 */
import {updateTransaction} from "../../../../protyle/wysiwyg/transaction/update";
/** 导出 updateTransaction 供 sizeMenu 子模块复用 */
export { updateTransaction };

/**
 * 用途：读取全局菜单实例。
 * 使用范围：尺寸提交后关闭菜单。
 * 解耦评估：菜单单例由环境层管理，子模块仅消费能力。
 */
import { getSiyuanGlobalMenusMenu } from "../../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenusMenu 供 sizeMenu 子模块复用 */
export { getSiyuanGlobalMenusMenu };

/**
 * 用途：读取国际化文案。
 * 使用范围：宽高菜单标签、默认值与 placeholder。
 * 解耦评估：文案来源统一，子模块无需跨层访问 i18n 环境。
 */
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 sizeMenu 子模块复用 */
export { siyuanI18n };
