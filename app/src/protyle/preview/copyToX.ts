import { Constants, fetchPost } from "../../ai/imports";
import { showMessage } from "../../dialog/message";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n";
import { addScriptSync } from "../util/addScript";
import { writeText } from "../util/compatibility";
import { focusByRange } from "../util/selection";
import { link2online } from "./link2online";
import { processPreviewElementsZhihuTable, processPreviewElementZhihuBlockquote } from "./zhihuAdapter";

export const copyPreviewHTMLToX = async (
    element: HTMLElement,
    copyElement: HTMLElement,
    id: string,
    target?: string,
) => {
    // fix math render
    if (target === "mp-wechat") {
        link2online(copyElement);
        copyElement.querySelectorAll(".katex-html .base").forEach((item) => {
            if (item instanceof HTMLElement) {
                item.style.display = "initial";
            }
        });
        copyElement.querySelectorAll("mjx-container > svg").forEach((item) => {
            //暂时硬写一个数字
            item.setAttribute("width", (parseInt(item.getAttribute("width") || "50") * 8) + "px");
        });
        // 列表嵌套 https://github.com/siyuan-note/siyuan/issues/11276
        copyElement.querySelectorAll("ul, ol").forEach(listItem => {
            Array.from(listItem.children).forEach(liItem => {
                const nestedList = liItem.querySelector("ul, ol");
                if (nestedList) {
                    liItem.parentNode?.insertBefore(nestedList, liItem.nextSibling);
                }
            });
        });
        // 处理任务列表（微信公众号不能显示input[type="checkbox"]）
        copyElement.querySelectorAll("li.protyle-task").forEach((taskItem) => {
            if (!(taskItem instanceof HTMLElement)) {
                return
            }
            const checkbox = taskItem.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox instanceof HTMLInputElement) {
                checkbox.style.opacity = "0";
                if (checkbox.checked) {
                    taskItem.style.setProperty("list-style-type", "'✅'", "important");
                } else {
                    taskItem.style.setProperty("list-style-type", "'▢'", "important");
                }
            }
        });
        if (typeof window.MathJax === "undefined") {
            window.MathJax = {
                svg: {
                    fontCache: "none"
                },
            };
        }
        await addScriptSync(`${Constants.PROTYLE_CDN}/js/mathjax/tex-svg-full.js`, "protyleMathJaxScript");
        await window.MathJax.startup?.promise;
        copyElement.querySelectorAll('[data-subtype="math"]').forEach(mathElement => {
            const node = window.MathJax.tex2svg && window.MathJax.tex2svg(Lute.UnEscapeHTMLStr(mathElement.getAttribute("data-content") || "").trim(), { display: mathElement.tagName === "DIV" });
            node?.querySelector("mjx-assistive-mml")?.remove();
            mathElement.innerHTML = node?.outerHTML || "";
        });
    } else if (target === "zhihu") {
        link2online(copyElement);
        copyElement.querySelectorAll('[data-subtype="math"]').forEach((item) => {
            // https://github.com/siyuan-note/siyuan/issues/10015
            item.outerHTML = `<img class="Formula-image" data-eeimg="true" src="//www.zhihu.com/equation?tex=" alt="${item.getAttribute("data-content")}" style="${item.tagName === "DIV" ? "display: block; max-width: 100%;" : ""}margin: 0 auto;">`;
        });
        copyElement.querySelectorAll("blockquote").forEach((item) => {
            const elements: HTMLElement[] = [];
            processPreviewElementZhihuBlockquote(item, elements);
            elements.reverse().forEach(newItem => {
                item.insertAdjacentElement("afterend", newItem);
            });
            item.remove();
        });
        processPreviewElementsZhihuTable(copyElement);
    } else if (target === "yuque") {
        fetchPost("/api/lute/copyStdMarkdown", {
            id,
            assetsDestSpace2Underscore: true,
            fillCSSVar: true,
            adjustHeadingLevel: true,
        }, (response) => {
            writeText(response.data);
            showMessage(`${siyuanI18n.pasteToYuque}`);
        });
        return;
    }

    // 防止背景色被粘贴到公众号中
    copyElement.style.backgroundColor = "#fff";
    // 代码背景
    copyElement.querySelectorAll("code").forEach((item) => {
        item.style.backgroundImage = "none";
    });
    element.append(copyElement);
    // 最后一个块是公式块时无法复制下来
    copyElement.insertAdjacentHTML("beforeend", "<p>&zwj;</p>");
    let cloneRange;
    let selection = getSelection()
    if (selection && selection.rangeCount > 0) {
        cloneRange = selection.getRangeAt(0).cloneRange();
    }
    const range = copyElement.ownerDocument.createRange();
    range.selectNodeContents(copyElement);
    focusByRange(range);
    document.execCommand("copy");
    element.lastElementChild && element.lastElementChild.remove();
    cloneRange && focusByRange(cloneRange);
    showMessage(`${target === "zhihu" ? siyuanI18n.pasteToZhihu : siyuanI18n.pasteToWechatMP}`);

}