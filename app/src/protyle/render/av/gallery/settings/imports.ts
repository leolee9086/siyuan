/** 用途：实例化 Gallery 设置菜单；使用范围：本域菜单工厂；解耦评估：直达 Menu 唯一实现。 */
import {Menu} from "../../../../../plugin/Menu";
/** 导出 Menu 实现。 */
export {Menu};

/** 用途：提交四类 Gallery 设置事务；使用范围：Cover/Size/Ratio；解耦评估：直达封闭 Prepared 命令。 */
import {submitAVGallerySettingTransaction} from "../../../../wysiwyg/transaction/prepared/av/view/avGallery";
/** 导出 Gallery 设置严格命令。 */
export {submitAVGallerySettingTransaction};

/** 用途：渲染资源字段 Emoji；使用范围：封面来源菜单；解耦评估：直达 Emoji 唯一实现。 */
import {unicode2Emoji} from "../../../../../emoji";
/** 导出 Emoji 渲染。 */
export {unicode2Emoji};

/** 用途：读取资源字段图标；使用范围：封面来源菜单；解耦评估：直达列元数据唯一实现。 */
import {getColIconByType} from "../../col/col.typeUtils";
/** 导出列图标查询。 */
export {getColIconByType};

/** 用途：读取当前视图属性名；使用范围：Size/Ratio 事务；解耦评估：直达协议常量。 */
import {Constants} from "../../../../../constants";
/** 导出协议常量。 */
export {Constants};

/** 用途：读取 Gallery 设置文案；使用范围：三个设置菜单；解耦评估：直达只读 i18n 环境。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出语言对象。 */
export {siyuanI18n};
