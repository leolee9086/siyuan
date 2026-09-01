/** 用途：提交封闭的添加列事务；使用范围：添加列菜单；解耦评估：直达 AV Column Add 严格命令，不加载通用事务 DOM 分派主图。 */
import {submitAVColumnStructureTransaction} from "../../../../wysiwyg/transaction/prepared/av/avColumnStructure";
/** 导出添加列严格命令。 */
export {submitAVColumnStructureTransaction};

/** 用途：生成更新时间；使用范围：添加列事务；解耦评估：第三方纯时间库。 */
import * as dayjs from "dayjs";
/** 导出时间库 */
export {dayjs};

/** 用途：提供列类型名称；使用范围：添加列菜单；解耦评估：直达只读语言环境。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出语言对象 */
export {siyuanI18n};

/** 用途：构建添加列菜单；使用范围：添加列入口；解耦评估：直接依赖完整 Menu 实现。 */
import {Menu} from "../../../../../plugin/Menu";
/** 导出菜单实现 */
export {Menu};

/** 用途：取得菜单常量；使用范围：添加列菜单身份；解耦评估：直达常量所有者。 */
import {Constants} from "../../../../../constants";
/** 导出常量 */
export {Constants};

/** 用途：渲染 Emoji 列图标；使用范围：新增表头；解耦评估：直达 Emoji 唯一实现。 */
import {unicode2Emoji} from "../../../../../emoji";
/** 导出 Emoji 渲染 */
export {unicode2Emoji};

/** 用途：转义新增列表头的属性值；使用范围：新增列插入动画；解耦评估：直达 DOM 转义唯一实现。 */
import {escapeAttr} from "../../../../../util/DOM/escape";
/** 导出属性转义。 */
export {escapeAttr};

/** 用途：转义新增列表头的可见名称；使用范围：新增列插入动画；解耦评估：直达 DOM 转义唯一实现。 */
import {escapeHtml} from "../../../../../util/DOM/escape";
/** 导出文本转义。 */
export {escapeHtml};

/** 用途：定位已有编辑面板；使用范围：添加列后刷新；解耦评估：直达定位唯一实现。 */
import {setPosition} from "../../../../../util/DOM/positioning/setPosition";
/** 导出面板定位 */
export {setPosition};

/** 用途：生成列编辑 HTML；使用范围：已有面板刷新；解耦评估：直达列编辑渲染所有者。 */
import {getEditHTML} from "../edit/render";
/** 导出列编辑 HTML */
export {getEditHTML};

/** 用途：绑定列编辑事件；使用范围：已有面板刷新；解耦评估：直达列编辑生命周期所有者。 */
import {bindEditEvent} from "../edit/render";
/** 导出列编辑绑定 */
export {bindEditEvent};

/** 用途：取得列类型图标；使用范围：新增列 DOM；解耦评估：直达列类型元数据。 */
import {getColIconByType} from "../col.typeUtils";
/** 导出列图标查询 */
export {getColIconByType};

/** 用途：取得列类型名称；使用范围：自定义属性行；解耦评估：直达列类型元数据。 */
import {getColNameByType} from "../col.typeUtils";
/** 导出列名称查询 */
export {getColNameByType};

/** 用途：生成默认列数据；使用范围：缺失面板后的编辑导航；解耦评估：直达列类型元数据。 */
import {genColDataByType} from "../col.typeUtils";
/** 导出默认列数据生成 */
export {genColDataByType};

/** 用途：读取视图字段；使用范围：添加列后的编辑导航；解耦评估：直达视图元数据所有者。 */
import {getFieldsByData} from "../../view/metadata";
/** 导出字段查询 */
export {getFieldsByData};

/** 用途：检查全局菜单；使用范围：打开编辑面板后的清理；解耦评估：直达环境读取实现。 */
import {getSiyuanMenus} from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出菜单读取 */
export {getSiyuanMenus};

/** 用途：移除全局菜单；使用范围：添加列导航收尾；解耦评估：直达环境动作实现。 */
import {removeSiyuanMenu} from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出菜单移除 */
export {removeSiyuanMenu};
