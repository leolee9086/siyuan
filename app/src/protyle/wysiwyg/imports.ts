/**
 * 用途：块级祖先查找，用于多选时定位选区起点对应的块节点
 * 使用范围：模块内各业务文件
 * 解耦评估：与 DOM 结构深度耦合，集中转发将路径依赖限制在单点
 */
import { hasClosestBlock } from "../util/hasClosest";
/**
 * 用途：最近类名匹配查找，用于检查已选中状态、查找父级选中块
 * 使用范围：模块内各业务文件
 * 解耦评估：同上，集中转发
 */
import { hasClosestByClassName } from "../util/hasClosest";
/** 导出块级祖先查找 */
export { hasClosestBlock };
/** 导出类名匹配查找 */
export { hasClosestByClassName };

/**
 * 用途：聚焦到指定块元素
 * 使用范围：选中块后聚焦到首块或尾块
 * 解耦评估：与选区模型耦合，集中转发
 */
import { focusBlock } from "../util/selection";
/** 导出聚焦工具 */
export { focusBlock };

/**
 * 用途：统计选中块总字数并更新状态栏
 * 使用范围：多选完成后调用
 * 解耦评估：集中转发
 */
import { countBlockWord } from "../runtime/status.port";
/** 导出字数统计 */
export { countBlockWord };

/**
 * 用途：显示消息提示
 * 使用范围：跨懒加载区域选中时给出提示
 * 解耦评估：集中转发
 */
import { showMessage } from "../runtime/dialog.port";
/** 导出消息提示 */
export { showMessage };

/**
 * 用途：国际化文案
 * 使用范围：跨懒加载提示消息参数
 * 解耦评估：集中转发
 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化文案 */
export { siyuanI18n };

/**
 * 用途：检查元素是否在嵌入块中，用于 ctrl+click 时提升到嵌入块级别
 * 使用范围：ctrl 选中时判断是否在嵌入块内
 * 解耦评估：集中转发
 */
import { isInEmbedBlock } from "../util/hasClosest";
/** 导出嵌入块检测 */
export { isInEmbedBlock };

/**
 * 用途：清除指定类型的多选样式（row、galleryItem）
 * 使用范围：ctrl 选中前清除已有选中
 * 解耦评估：集中转发
 */
import { clearSelect } from "../util/clearSelect";
/** 导出清除选中 */
export { clearSelect };

/**
 * 用途：执行属性视图行选中/切换操作
 * 使用范围：ctrl+click 在属性视图中选中行
 * 解耦评估：集中转发
 */
import { selectRow } from "../render/av/row";
/** 导出属性视图行选中 */
export { selectRow };

/**
 * 用途：判断事件是否为纯粹的 meta 键（ctrl/cmd）点击
 * 使用范围：ctrl+click 判断入口条件
 * 解耦评估：集中转发
 */
import { isOnlyMeta } from "../util/compatibility";
/** 导出 meta 键检测 */
export { isOnlyMeta };

/** 用途：Rect 几何矩形类型。使用范围：collectSelectedBlocks 等函数的参数类型。解耦评估：类型导入，不涉及运行时耦合。 */
import type { Rect } from "../../types/geometry.types";
/** 导出 Rect 类型 */
export type { Rect };

/**
 * 用途：几何厂牌类型构造器 createPoint/createBoundingRect
 * 使用范围：computeSelectRect 模块和调用方
 * 解耦评估：类型工厂函数，通过 imports.ts 转发避免跨目录路径散落
 */
import { createPoint, createBoundingRect, createRect } from "../../types/geometry.guards";
/** 导出 createPoint */
export { createPoint };
/** 导出 createBoundingRect */
export { createBoundingRect };
/** 导出 createRect */
export { createRect };
