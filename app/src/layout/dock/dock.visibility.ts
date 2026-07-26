/** Dock 初始化数据的纯可见性校验；不读取或加载 Dock 实例。 */

/**
 * @简洁函数 检查 item 是否为有效类型
 */
const isValidType = (item: Config.IUILayoutDockTab, types: string[]) => types.includes(item.type) || item.type.startsWith("custom_list:");

/**
 * 检查数据数组中是否包含有效的类型
 */
export function hasValidDockType(data: Config.IUILayoutDockTab[][], types: string[]): boolean {
    const first = data[0];
    const second = data[1];
    const firstHasType = first ? first.find(item => isValidType(item, types)) : undefined;
    const secondHasType = second ? second.find(item => isValidType(item, types)) : undefined;
    return Boolean(firstHasType) || Boolean(secondHasType);
}
