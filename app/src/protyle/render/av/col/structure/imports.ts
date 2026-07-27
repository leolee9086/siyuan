/** 用途：提交添加、复制和删除列结构事务；使用范围：结构编排；解耦评估：直达 Column Structure 严格命令，不加载通用事务主图。 */
import {submitAVColumnStructureTransaction} from "../../../../wysiwyg/transaction/prepared/av/avColumnStructure";
/** 导出列结构严格命令。 */
export {submitAVColumnStructureTransaction};

/** 用途：生成结构变更更新时间；使用范围：复制与删除编排；解耦评估：第三方纯时间库。 */
import * as dayjs from "dayjs";
/** 导出时间库。 */
export {dayjs};

/** 用途：执行添加或复制后的唯一 DOM 与编辑导航呈现；使用范围：复制列；解耦评估：直达添加呈现唯一实现。 */
import {addAttrViewColAnimation} from "../add/presentation";
/** 导出添加列呈现。 */
export {addAttrViewColAnimation};

/** 用途：刷新删除后的 Properties Panel；使用范围：Panel 删除；解耦评估：直达 Properties 唯一渲染实现。 */
import {getPropertiesHTML} from "../properties/render";
/** 导出 Properties HTML。 */
export {getPropertiesHTML};

/** 用途：生成重复列名称；使用范围：复制列；解耦评估：直达纯命名工具。 */
import {duplicateNameAddOne} from "../../../../../util/platform/functions";
/** 导出重复名称工具。 */
export {duplicateNameAddOne};

/** 用途：重定位删除后的 Panel；使用范围：Panel 删除；解耦评估：直达 DOM 定位唯一实现。 */
import {setPosition} from "../../../../../util/DOM/positioning/setPosition";
/** 导出 DOM 定位。 */
export {setPosition};

/** 用途：读取当前视图字段原数组；使用范围：复制列；解耦评估：直达视图元数据所有者。 */
import {getFieldsByData} from "../../view/metadata";
/** 导出字段读取。 */
export {getFieldsByData};

/** 用途：约束复制后编辑导航所需的完整 Panel 外观；使用范围：结构操作参数；解耦评估：纯类型直达领域声明，不加载具体 Panel。 */
import type {AVMenuPanelDomain} from "../../openMenuPanel.types";
/** 导出完整 Panel 领域外观。 */
export type {AVMenuPanelDomain};
