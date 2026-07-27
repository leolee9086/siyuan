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
import { getEditHTML } from "./edit/render";

/**
 * 用途：绑定列编辑事件
 * 使用范围：在列编辑界面渲染后绑定交互事件
 * 解耦评估：这是同一功能模块内的事件绑定函数，直接导入合理
 */
import { bindEditEvent } from "./edit/render";

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
 * 用途：提供完整 AV 菜单面板领域外观
 * 使用范围：列菜单调用添加列、复制列等需要后续编辑导航的流程
 * 解耦评估：调用方依赖带厂牌完整外观；Add 子域仅接收参数，不反向导入具体组合模块。
 */
import {avMenuPanel} from "../openMenuPanel";
/** 用途：打开字段编辑 Panel；使用范围：列菜单中配置不足后的既有导航；解耦评估：直达同一 Panel 唯一实现，不创建第二包装。 */
import {openMenuPanel} from "../openMenuPanel";

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

/** 导出完整 AV 菜单面板领域外观 */
export {avMenuPanel};
/** 导出既有 Panel 打开入口。 */
export {openMenuPanel};

/** 导出字段数据获取函数 */
export { getFieldsByData };

/** 导出菜单获取函数 */
export { getSiyuanMenus };

/** 导出菜单移除函数 */
export { removeSiyuanMenu };
