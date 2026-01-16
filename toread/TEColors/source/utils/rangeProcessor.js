import { hasClosestBlock } from "./DOMFinder.js";
export function 获取光标所在块元素() {
    // 获取选区对象
    const selection = window.getSelection();
    if (!selection) return null;
    // 获取选区范围
    let range;
    try {
        range = selection.getRangeAt(0);
        if (!range) return null;
    } catch (e) {
        return null;
    }
    // 找到离范围最近的可编辑祖先元素
    let current = range.commonAncestorContainer;
    while (current !== document) {
        if (current.nodeType === 1 && current.getAttribute("contenteditable")) {
            break;
        }
        current = current.parentNode;
    }
    try{
    return hasClosestBlock(current)
    }catch(e){
        return null
    }
}

