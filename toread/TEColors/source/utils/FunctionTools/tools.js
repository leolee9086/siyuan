export function 保持选区执行操作(action) {
    return (...args) => {
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        action(...args);

        // 恢复光标位置
        if (range) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}