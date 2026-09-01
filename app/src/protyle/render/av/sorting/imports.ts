/** 用途：创建添加排序菜单；使用范围：Sort 领域入口；解耦评估：直达完整 Menu 实现，仅在 UI 工厂边界实例化。 */
import {Menu} from "../../../../plugin/Menu";
/** 导出 Menu 实现。 */
export {Menu};

/** 用途：读取列类型图标；使用范围：排序字段菜单；解耦评估：直达列元数据唯一实现。 */
import {getColIconByType} from "../col/col.typeUtils";
/** 导出列图标查询。 */
export {getColIconByType};

/** 用途：提交完整排序列表；使用范围：添加与修改排序；解耦评估：直达现有 Sort Prepared 命令，不加载通用事务主图。 */
import {submitAVSortTransaction} from "../../../wysiwyg/transaction/prepared/av/view/avSort";
/** 导出 Sort 严格命令。 */
export {submitAVSortTransaction};

/** 用途：定位排序 Panel；使用范围：添加排序后刷新；解耦评估：直达 DOM 定位唯一实现。 */
import {setPosition} from "../../../../util/DOM/positioning/setPosition";
/** 导出 Panel 定位。 */
export {setPosition};

/** 用途：渲染列 Emoji；使用范围：排序字段菜单和 Select；解耦评估：直达 Emoji 唯一实现。 */
import {unicode2Emoji} from "../../../../emoji";
/** 导出 Emoji 渲染。 */
export {unicode2Emoji};

/** 用途：读取当前视图字段原数组；使用范围：添加排序；解耦评估：直达视图元数据所有者。 */
import {getFieldsByData} from "../view/metadata";
/** 导出字段读取。 */
export {getFieldsByData};

/** 用途：转义排序字段名称。使用范围：Select option 文本。 */
import {escapeHtml} from "../../../../util/DOM/escape";
export {escapeHtml};

/** 用途：提供添加排序菜单身份；使用范围：Sort 菜单工厂；解耦评估：直达不可变协议常量。 */
import {Constants} from "../../../../constants";
/** 导出菜单常量。 */
export {Constants};

/** 用途：读取 Sort 文案；使用范围：排序 HTML 和菜单；解耦评估：直达只读 i18n 环境。 */
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出语言对象。 */
export {siyuanI18n};
