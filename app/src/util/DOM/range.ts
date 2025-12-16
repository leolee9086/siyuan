export const getSelection = () => {
    const selection = window.getSelection();
    if (!selection) {
        console.error(selection);
        throw new Error("getSelection 方法未返回有效值");
    }
    return selection;
};
export const getFirstSelectedRange = () => {
    if (getSelection().rangeCount > 0) {
        const range = getSelection().getRangeAt(0);
        return range;
    }else {
        return undefined;
    }
};