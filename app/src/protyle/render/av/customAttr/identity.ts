/**
 * 判断单元格是否携带自定义属性面板的 AV 身份。
 * 保留原 `getAttribute` 真值语义：缺失属性或空字符串均不是有效身份。
 * @同步豁免: 类型守卫 - 调用方需要在当前 DOM 分支中立即选择行 ID 解析策略。
 */
export const isCustomAttributeCell = (cellElement: Element) => !!cellElement.getAttribute("data-av-id");
