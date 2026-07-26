/**
 * 用途：日期格式化库，用于格式化单元格中的日期时间显示
 * 使用范围：render和renderRollup函数中格式化date/updated/created类型单元格
 * 解耦评估：无法解耦，日期格式化是核心功能，需要专业库支持
 */
import * as dayjs from "dayjs";
/**
 * 用途：全局常量定义，用于访问LOCAL_IMAGES等配置
 * 使用范围：render和renderRollup中获取默认图标配置
 * 解耦评估：可通过参数传递解耦，但会增加函数签名复杂度，当前耦合合理
 */
import { Constants } from "../../../../constants";
/**
 * 用途：国际化文本，用于显示"未命名"等本地化文本
 * 使用范围：render和renderRollup中显示block类型单元格的默认标题
 * 解耦评估：可通过参数传递解耦，但会增加调用复杂度，当前耦合合理
 */
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/**
 * 用途：Unicode转Emoji，用于显示block类型单元格的图标
 * 使用范围：render和renderRollup中渲染block单元格图标
 * 解耦评估：可通过参数传递解耦，但会增加函数签名复杂度，当前耦合合理
 */
import { unicode2Emoji } from "../../../../emoji";
/**
 * 用途：HTML属性转义函数，用于防止XSS攻击
 * 使用范围：render函数中转义URL等属性值
 * 解耦评估：无法解耦，安全转义是必需功能
 */
import { escapeAttr } from "../../../../util/DOM/escape";
/**
 * 用途：HTML内容转义函数，用于防止XSS攻击
 * 使用范围：render函数中转义HTML内容
 * 解耦评估：无法解耦，安全转义是必需功能
 */
import { escapeHtml } from "../../../../util/DOM/escape";
/**
 * 用途：ARIA 标签转义函数，用于安全生成可访问性标签
 * 使用范围：render函数中转义资源单元格的aria-label
 * 解耦评估：无法解耦，安全转义是必需功能
 */
import { escapeAriaLabel } from "../../../../util/DOM/escape";
/**
 * 用途：图片压缩URL生成，用于优化图片加载性能
 * 使用范围：render函数中处理mAsset类型的图片资源
 * 解耦评估：可通过参数传递解耦，但会增加函数签名复杂度，当前耦合合理
 */
import { getCompressURL } from "../../../../util/assets/image";

/** 导出日期格式化库 */
export { dayjs };
/** 导出全局常量 */
export { Constants };
/** 导出国际化文本 */
export { siyuanI18n };
/** 导出Emoji转换函数 */
export { unicode2Emoji };
/** 导出HTML属性转义函数 */
export { escapeAttr };
/** 导出HTML内容转义函数 */
export { escapeHtml };
/** 导出ARIA标签转义函数 */
export { escapeAriaLabel };
/** 导出图片压缩URL生成函数 */
export { getCompressURL };
