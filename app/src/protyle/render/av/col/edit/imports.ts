/** 用途：渲染自定义图标；使用范围：编辑模板；解耦评估：直达 Emoji 唯一实现。 */
import {unicode2Emoji} from "../../../../../emoji";
/** 导出 Emoji 渲染。 */
export {unicode2Emoji};
/** 用途：绑定 Rollup；使用范围：编辑生命周期；解耦评估：直达 Rollup 唯一实现。 */
import {bindRollupData} from "../../rollup";
/** 导出 Rollup 绑定。 */
export {bindRollupData};
/** 用途：转义属性；使用范围：编辑模板；解耦评估：直达 DOM 转义实现。 */
import {escapeAriaLabel, escapeAttr, escapeHtml} from "../../../../../util/DOM/escape";
/** 导出 aria 属性转义。 */
export {escapeAriaLabel};
/** 导出普通属性转义。 */
export {escapeAttr};
/** 导出 HTML 文本转义。 */
export {escapeHtml};
/** 用途：获取字段集合；使用范围：目标列解析；解耦评估：直达元数据实现。 */
import {getFieldsByData} from "../../view/metadata";
/** 导出字段集合查询。 */
export {getFieldsByData};
/** 用途：读取编辑文案；使用范围：编辑模板；解耦评估：直达 i18n 环境。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出编辑文案。 */
export {siyuanI18n};
/** 用途：读取列类型映射；使用范围：编辑模板；解耦评估：直达列映射唯一实现。 */
import {getColIconByType, getColNameByType} from "../col.typeUtils";
/** 导出列类型图标。 */
export {getColIconByType};
/** 导出列类型名称。 */
export {getColNameByType};
/** 用途：构建类型编辑模板；使用范围：编辑渲染；解耦评估：直达模板唯一实现。 */
import {genUpdateColItem, getTypeSpecificEditHTML} from "../col.editPanel";
/** 导出类型选择项。 */
export {genUpdateColItem};
/** 导出类型特有模板。 */
export {getTypeSpecificEditHTML};
/** 用途：绑定编辑事件；使用范围：编辑生命周期；解耦评估：直达事件唯一实现。 */
import {bindAddOptionEvent, bindDateSwitchEvents, bindDescEvents, bindIncludeTimeEvent, bindNameEvents, bindTemplateEvents, bindWrapEvent} from "../col.editPanel.bind";
/** 导出新增选项事件。 */
export {bindAddOptionEvent};
/** 导出日期开关事件。 */
export {bindDateSwitchEvents};
/** 导出描述事件。 */
export {bindDescEvents};
/** 导出时间开关事件。 */
export {bindIncludeTimeEvent};
/** 导出名称事件。 */
export {bindNameEvents};
/** 导出模板事件。 */
export {bindTemplateEvents};
/** 导出换行事件。 */
export {bindWrapEvent};
/** 用途：绑定反向关联；使用范围：编辑生命周期；解耦评估：直达关联事件唯一实现。 */
import {bindBackRelationEvents} from "../col.editPanel.bind.relation";
/** 导出反向关联事件。 */
export {bindBackRelationEvents};
/** 用途：约束完整编辑上下文；使用范围：事件装配；解耦评估：纯类型直达领域声明。 */
import type {IBindEditContext} from "../col.editPanel.bind.types";
/** 导出完整编辑上下文。 */
export type {IBindEditContext};
