/** 用途：转义源码行内容后再写入测量镜像。使用范围：仅行号软换行高度测量。解耦评估：复用既有细粒度 DOM 工具，避免重复实现 HTML 转义。 */
import {escapeHtml} from "./imports";

/** 创建源码文本域的行号同步器；用镜像元素测量软换行后的真实视觉高度。 */
/** @同步豁免: UI构建 - 输入与面板缩放时必须同步测量当前布局。 */
export const createLineNumberRenderer = (textElement: HTMLTextAreaElement, gutter: HTMLElement) => {
    return () => {
        const lineList = textElement.value.split(/\r\n|\r|\n/);
        const textStyle = window.getComputedStyle(textElement);
        const mirror = document.createElement("div");
        mirror.style.position = "absolute";
        mirror.style.visibility = "hidden";
        mirror.style.whiteSpace = "pre-wrap";
        mirror.style.overflowWrap = "break-word";
        mirror.style.wordBreak = "normal";
        mirror.style.tabSize = textStyle.tabSize;
        mirror.style.fontFamily = textStyle.fontFamily;
        mirror.style.fontSize = textStyle.fontSize;
        mirror.style.lineHeight = textStyle.lineHeight;
        mirror.style.fontWeight = textStyle.fontWeight;
        mirror.style.fontVariantLigatures = textStyle.fontVariantLigatures;
        mirror.style.letterSpacing = textStyle.letterSpacing;
        mirror.style.width = textElement.getBoundingClientRect().width + "px";
        mirror.style.boxSizing = "border-box";
        mirror.style.padding = "4px 8px";
        mirror.innerHTML = lineList.map(line => `<div>${line.trim() ? escapeHtml(line) : "&nbsp;"}</div>`).join("");
        const mirrorHost = gutter.parentElement || document.body;
        mirrorHost.appendChild(mirror);
        let lineNumbersHTML = "";
        for (let index = 0; index < lineList.length; index++) {
            const lineElement = mirror.children.item(index);
            if (!lineElement) {
                throw new Error(`Missing mirrored source line at index ${index}`);
            }
            lineNumbersHTML += `<span style="height:${lineElement.clientHeight}px"></span>`;
        }
        mirror.remove();
        gutter.innerHTML = lineNumbersHTML;
    };
};
