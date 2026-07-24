/** 用途：标注当前矩形元素类型；使用范围：PDF 注释交互共享状态；解耦评估：纯类型依赖。 */
import type { RectElementType } from "../anno.types";

/** 当前正在操作的矩形注释元素。 */
export let rectElement: RectElementType;

/** @同步豁免: 生命周期 选中状态必须在当前事件调用栈内立即清除，后续工具栏逻辑会同步读取。 */
export const clearRectElement = () => {
    rectElement = null;
};

/** @同步豁免: 生命周期 选中状态必须在当前事件调用栈内立即更新，后续动作会同步读取。 */
export const setRectElement = (element: RectElementType) => {
    rectElement = element;
};
