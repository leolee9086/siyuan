/**
 * 用途：描述一次 Gallery 布局设置菜单所需的完整宿主与视图状态。
 * 使用场景：封面来源、卡片尺寸和宽高比设置菜单。
 * 关联类型：组合现有 IAVGallery、IProtyle 和触发菜单的 DOM，不引入宿主 Port。
 * 问题/改进：无；四项共同确定事务身份、原地状态和菜单定位。
 */
export type GallerySettingOptions = {
    view: IAVGallery,
    nodeElement: Element,
    protyle: IProtyle,
    target: HTMLElement,
};

/**
 * 用途：描述一个已校验身份的 Gallery 设置菜单完整交互上下文。
 * 使用场景：菜单项点击时提交事务并同步当前视图和标签。
 * 关联类型：在 `GallerySettingOptions` 基础上加入同一宿主的 AV/Block 身份与标签节点。
 * 问题/改进：View ID 仅 Size/Ratio 需要，因此由对应完整行为独立校验，不放入公共上下文。
 */
export type GallerySettingContext = {
    options: GallerySettingOptions,
    avID: string,
    blockID: string,
    labelElement: Element,
};
