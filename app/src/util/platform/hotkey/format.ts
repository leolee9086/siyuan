/**
 * 判断当前平台是否使用 macOS 快捷键符号。
 *
 * @同步豁免: UI构建 - 平台环境读取必须在生成当前界面文案时同步完成。
 */
export const isMac = () => navigator.platform.toUpperCase().indexOf("MAC") > -1;

/**
 * 判断事件是否只按下当前平台的主修饰键。
 *
 * @同步豁免: UI构建 - 键盘和鼠标事件分派必须同步判定修饰键状态。
 */
export const isOnlyMeta = (event: KeyboardEvent | MouseEvent) => {
    if (isMac()) {
        return event.metaKey && !event.ctrlKey;
    }
    return !event.metaKey && event.ctrlKey;
};

/**
 * 判断事件是否未按下 Meta 或 Control。
 *
 * @同步豁免: UI构建 - 键盘和鼠标事件分派必须同步判定修饰键状态。
 */
export const isNotCtrl = (event: KeyboardEvent | MouseEvent) => !event.metaKey && !event.ctrlKey;

/**
 * 将内部统一快捷键符号转换为当前平台展示文本。
 *
 * @同步豁免: UI构建 - 纯字符串格式化用于同步 HTML 和控件属性生成。
 */
export const updateHotkeyTip = (hotkey: string) => {
    if (!hotkey || isMac()) {
        return hotkey;
    }
    const keys = [];
    // Windows/Linux 将 Meta 或 Control 符号统一显示为 Ctrl。
    if (hotkey.indexOf("⌘") > -1 || hotkey.indexOf("⌃") > -1) {
        keys.push("Ctrl");
    }
    // 内部 Shift 符号在非 Mac 平台显示完整键名。
    if (hotkey.indexOf("⇧") > -1) {
        keys.push("Shift");
    }
    // 内部 Option 符号在非 Mac 平台对应 Alt。
    if (hotkey.indexOf("⌥") > -1) {
        keys.push("Alt");
    }

    // 保留完整尾键以正确显示 F2 等多字符按键。
    const lastKey = hotkey.replace(/[⌘⇧⌥⌃]/g, "");
    if (lastKey) {
        keys.push({
            "⇥": "Tab",
            "⌫": "Backspace",
            "⌦": "Delete",
            "↩": "Enter",
        }[lastKey] || lastKey);
    }
    return keys.join("+");
};

/**
 * 在非空快捷键前附加指定分隔符并格式化平台文案。
 *
 * @同步豁免: UI构建 - 纯字符串格式化用于同步 HTML 和控件属性生成。
 */
export const updateHotkeyAfterTip = (hotkey: string, split = " ") => {
    if (hotkey) {
        return split + updateHotkeyTip(hotkey);
    }
    return "";
};
