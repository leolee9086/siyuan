/** 规范化布局方向，供 Layout 构造和反序列化参数复用。 */
/** @同步豁免: 类型守卫 */
export function ensureDirection(direction: Config.TUILayoutDirection | undefined) {
    return direction || "tb";
}

/** 规范化布局尺寸，保持未提供尺寸时的自动伸缩语义。 */
/** @同步豁免: 类型守卫 */
export function ensureSize(size: string | undefined) {
    return size || "auto";
}

/** 规范化布局类型，保持未提供类型时的普通布局语义。 */
/** @同步豁免: 类型守卫 */
export function ensureType(type: Config.TUILayoutType | undefined) {
    return type || "normal";
}
