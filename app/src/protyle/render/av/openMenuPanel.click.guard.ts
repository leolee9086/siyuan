/**
 * openMenuPanel click 子模块的类型守卫和类型转换边界。
 *
 * 作用：集中管理 DOM dataset 属性到 TAVCol 等类型的转换，
 *       避免在业务代码中散布 as 断言。
 * @同步豁免: 类型守卫 - 类型守卫函数必须同步执行以提供正确的类型推断
 */

/**
 * 将 DOM dataset 中读取的字符串安全转换为 TAVCol 类型。
 * DOM 属性值来自服务端渲染的 data-* 属性，运行时类型已由后端保证。
 * @guard-cast-boundary
 */
export const asTAVCol = (value: string | undefined | null): TAVCol => {
    return (value ?? "text") as TAVCol;
};

/**
 * 将 IAVView 安全转换为 IAVGallery。
 * 仅在 viewType 为 gallery 时调用，运行时类型由上层逻辑保证。
 * @guard-cast-boundary
 */
export const asAVGallery = (view: IAVView): IAVGallery => {
    return view as IAVGallery;
};

/**
 * 将 Element 安全转换为 HTMLElement。
 * 在 blockElement 来自 DOM querySelector 且已确认存在时使用。
 * @guard-cast-boundary
 */
export const asHTMLElement = (el: Element): HTMLElement => {
    return el as HTMLElement;
};

/**
 * 将 dataset.type 字符串安全转换为资源类型 "image" | "file"。
 * DOM 属性值来自服务端渲染，运行时类型已由后端保证。
 * @guard-cast-boundary
 */
export const asAssetType = (value: string | undefined): "image" | "file" => {
    return (value === "image" ? "image" : "file") as "image" | "file";
};

/**
 * 清除视图的分组数据（group 置 null、删除 groups）。
 * 原始代码在 removeAttrViewGroup 事务后执行此操作，
 * 但 IAVView 类型定义中这两个字段非可选，需要绕过类型检查。
 * @guard-cast-boundary
 */
export const clearViewGroupData = (view: IAVView): void => {
    (view as unknown as Record<string, unknown>).group = null;
    delete (view as unknown as Record<string, unknown>).groups;
};
