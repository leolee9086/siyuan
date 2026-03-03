/**
 * CSS 渐变方向类型
 * 
 * 用途：定义 CSS linear-gradient 函数支持的方向值
 * 
 * 使用场景：
 * - 在生成线性渐变背景时指定渐变方向
 * - 支持关键字方向（to top/right/bottom/left）和角度值（如 45deg、-20deg）
 * 
 * 关联类型：
 * - 被 GradientConfig 类型引用，作为渐变配置的方向属性
 * - 与 CSS linear-gradient() 函数的第一个参数对应
 * 
 * 技术说明：
 * - 关键字方向遵循 CSS 标准，表示渐变终点方向
 * - 角度值使用模板字面量类型，支持任意数字+deg组合（包括负数）
 * - 0deg 表示向上，角度顺时针增加（90deg向右，180deg向下，270deg向左）
 */
export type GradientDirection =
  | "to top"
  | "to right"
  | "to bottom"
  | "to left"
  | `${number}deg`;

/**
 * 颜色节点类型
 * 
 * 用途：定义渐变中的单个颜色停止点
 * 
 * 使用场景：
 * - 在渐变配置中指定颜色及其位置
 * - 构建多色渐变效果
 * 
 * 关联类型：
 * - 被 GradientConfig 类型的 colorNodes 数组引用
 * 
 * 属性说明：
 * - color: 十六进制颜色值（如 #ff0000）
 * - position: 颜色在渐变中的位置百分比（0-100）
 */
export type ColorNode = {
  color: string;
  position: number;
};

/**
 * 渐变配置类型
 * 
 * 用途：完整描述一个线性渐变的所有参数
 * 
 * 使用场景：
 * - 作为 generateLinearGradient 函数的输入参数
 * - 存储和传递渐变配置数据
 * - 预定义渐变样式的数据结构
 * 
 * 关联类型：
 * - 使用 GradientDirection 定义方向
 * - 使用 ColorNode 数组定义颜色节点
 * 
 * 约束条件：
 * - colorNodes 至少需要 2 个元素才能形成有效渐变
 * - 通过 Zod schema 在运行时验证
 */
export type GradientConfig = {
  direction: GradientDirection;
  colorNodes: ColorNode[];
};
