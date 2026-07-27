/** 用途：提交 Groups 严格事务；使用范围：隐藏、显示与清除 Panel 动作；解耦评估：直达 Groups Prepared 命令，不加载通用事务主图。 */
import {submitAVGroupTransaction} from "../../../../wysiwyg/transaction/prepared/av/group/avGroup";
/** 导出 Groups 严格命令。 */
export {submitAVGroupTransaction};

/** 用途：定位 Groups Panel；使用范围：Panel 内容切换与清除后刷新；解耦评估：直达 DOM 定位唯一实现。 */
import {setPosition} from "../../../../../util/DOM/positioning/setPosition";
/** 导出 Panel 定位。 */
export {setPosition};

/** 用途：读取当前视图字段原数组；使用范围：日期/排序设置返回；解耦评估：直达视图元数据所有者。 */
import {getFieldsByData} from "../../view/metadata";
/** 导出字段读取。 */
export {getFieldsByData};

/** 用途：复用 Groups HTML、绑定和方法实现；使用范围：Panel 全部导航动作；解耦评估：直达当前唯一 Groups 实现，后续由本专项继续拆分。 */
import {bindGroupsEvent, bindGroupsNumber, getGroupsHTML, getGroupsMethodHTML, getGroupsNumberHTML, goGroupsDate, goGroupsSort, setGroupMethod} from "../../groups";
/** 导出 Groups 事件绑定。 */
export {bindGroupsEvent};
/** 导出 Groups 数值绑定。 */
export {bindGroupsNumber};
/** 导出 Groups 列表 HTML。 */
export {getGroupsHTML};
/** 导出 Groups 方法 HTML。 */
export {getGroupsMethodHTML};
/** 导出 Groups 数值 HTML。 */
export {getGroupsNumberHTML};
/** 导出 Groups 日期导航。 */
export {goGroupsDate};
/** 导出 Groups 排序导航。 */
export {goGroupsSort};
/** 导出 Groups 方法设置。 */
export {setGroupMethod};

/** 用途：移除全局菜单；使用范围：Groups Panel 动作前置清理；解耦评估：直达环境动作唯一实现。 */
import {removeSiyuanMenu} from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出菜单移除。 */
export {removeSiyuanMenu};

/** 用途：读取 Groups 显示文本；使用范围：显示/隐藏全部按钮；解耦评估：直达只读 i18n 环境。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出语言对象。 */
export {siyuanI18n};

/** 用途：清除视图分组本地数据；使用范围：移除全部分组；解耦评估：直达 Panel 守卫/变换唯一实现。 */
import {clearViewGroupData} from "../../openMenuPanel.click.guard";
/** 导出分组清理。 */
export {clearViewGroupData};

/** 用途：约束 Groups Panel 的完整运行上下文；使用范围：交互处理器；解耦评估：纯类型直达完整 Panel 上下文声明。 */
import type {IMenuPanelContext} from "../../openMenuPanel.types";
/** 导出完整 Panel 上下文。 */
export type {IMenuPanelContext};
