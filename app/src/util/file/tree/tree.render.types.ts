/** 用途：从完整 Tree 配置派生渲染字段；使用范围：Tree HTML 渲染；边界：经本域 imports 直接引用真实定义。 */
import type {TreeOptions} from "./imports";

/** Tree 渲染阶段读取的不可变配置，字段直接派生自完整 TreeOptions，不构成外部宿主契约。 */
export type TreeRenderOptions = {
    blockDraggable: TreeOptions["blockDraggable"];
    blockExtHTML: TreeOptions["blockExtHTML"];
    topExtHTML: TreeOptions["topExtHTML"];
    titleTooltipPosition: TreeOptions["titleTooltipPosition"];
};
