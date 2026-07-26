/**
 * 用途：转发父级目录的导入，避免直接使用 ../ 导入
 * 使用范围：col 目录下的所有模块
 */

/**
 * 用途：将 emoji unicode 转换为 HTML 元素
 * 使用范围：在列头部显示自定义图标时使用
 * 解耦评估：这是纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { unicode2Emoji } from "../../../../emoji";

/**
 * 用途：设置浮动面板的位置
 * 使用范围：在打开编辑面板时定位面板位置
 * 解耦评估：这是纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { setPosition } from "../../../../util/DOM/positioning/setPosition";

/**
 * 用途：获取列编辑的 HTML 内容
 * 使用范围：在需要显示列编辑界面时使用
 * 解耦评估：这是同一功能模块内的UI构建函数，直接导入合理
 */
import { getEditHTML } from "./col";

/**
 * 用途：绑定列编辑事件
 * 使用范围：在列编辑界面渲染后绑定交互事件
 * 解耦评估：这是同一功能模块内的事件绑定函数，直接导入合理
 */
import { bindEditEvent } from "./col";

/**
 * 用途：根据列类型获取对应的图标
 * 使用范围：在渲染列头部时显示类型图标
 * 解耦评估：这是纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { getColIconByType } from "./col.typeUtils";

/**
 * 用途：根据列类型获取对应的名称
 * 使用范围：在渲染列信息时显示类型名称
 * 解耦评估：这是纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { getColNameByType } from "./col.typeUtils";

/**
 * 用途：根据列类型生成默认的列数据
 * 使用范围：在创建新列时生成初始数据
 * 解耦评估：这是纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { genColDataByType } from "./col.typeUtils";

/**
 * 用途：打开属性视图面板（编辑、选择、配置等多种类型）
 * 使用范围：在列操作流程中使用，特别是添加列后需要打开编辑面板的场景
 * 解耦评估：当前直接调用是合理的，因为这是同一功能模块内的UI流程操作。
 * 理论上可通过事件发射解耦（如 EventEmitter.emit('openPanel', options)），
 * 但会增加代码复杂度和调试难度，且该函数已经是高度抽象的通用面板打开器，
 * 进一步解耦收益不大。建议保持当前直接调用方式。
 */
import { openMenuPanel } from "../openMenuPanel";

/**
 * 用途：从属性视图数据中获取字段列表
 * 使用范围：在需要访问视图字段信息时使用
 * 解耦评估：这是数据访问函数，直接导入合理
 */
import { getFieldsByData } from "../view/metadata";

/**
 * 用途：获取全局菜单对象
 * 使用范围：在需要检查菜单是否存在时使用
 * 解耦评估：这是对window.siyuan.menus的封装，已在environment文件中实现，当前导入方式合理
 */
import { getSiyuanMenus } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 用途：移除当前显示的全局菜单
 * 使用范围：在打开新面板后需要清理旧菜单时使用
 * 解耦评估：这是对window.siyuan.menus.menu.remove()的封装，已在environment文件中实现，当前导入方式合理
 */
import { removeSiyuanMenu } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";

/** 导出 emoji 工具函数 */
export { unicode2Emoji };

/** 导出位置设置工具函数 */
export { setPosition };

/** 导出列编辑 HTML 生成函数 */
export { getEditHTML };

/** 导出列编辑事件绑定函数 */
export { bindEditEvent };

/** 导出列类型图标获取函数 */
export { getColIconByType };

/** 导出列类型名称获取函数 */
export { getColNameByType };

/** 导出列数据生成函数 */
export { genColDataByType };

/** 导出面板操作函数 */
export { openMenuPanel };

/** 导出字段数据获取函数 */
export { getFieldsByData };

/** 导出菜单获取函数 */
export { getSiyuanMenus };

/** 导出菜单移除函数 */
export { removeSiyuanMenu };
