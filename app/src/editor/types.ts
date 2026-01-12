/**
 * 页签初始化数据接口
 *
 * 用途：用于描述 Tab 元素上 `data-initdata` 属性解析后的 JSON 对象结构。
 * 使用场景：在 restore 页签或者判定未初始化页签是否可复用时使用。
 * 关联类型：与 ILayoutJSON 有重叠，但 action 字段更为宽松（支持数组）。
 */
export interface ITabInitData {
    instance: string;
    rootId?: string | undefined;
    blockId?: string | undefined;
    mode?: TEditorMode | undefined;
    action?: TProtyleAction | TProtyleAction[] | undefined;
    customModelData?: unknown; // Keep any for now as it can be complex, or unknown
    customModelType?: string | undefined;
}
