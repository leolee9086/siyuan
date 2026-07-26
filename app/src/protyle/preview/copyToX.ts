import {Constants} from "./imports";
import {fetchPost} from "./imports";
import {showMessage} from "./imports";
import {siyuanI18n} from "./imports";
import {addScriptSync} from "./imports";
import {writeText} from "./imports";
import {focusByRange} from "./imports";
import { link2online } from "./link2online";
import { processPreviewElementsZhihuTable, processPreviewElementZhihuBlockquote } from "./zhihuAdapter";

export type TCopyTargetPlatform = "mp-wechat" | "zhihu" | "yuque";

/**
 * 处理微信公众号的HTML预处理
 * @param copyElement 需要预处理的HTML元素
 */
const processWeChatHTML = async (copyElement: HTMLElement) => {
    // 处理链接转换为在线链接
    link2online(copyElement);

    // 修复数学公式渲染 - 显示KaTeX HTML
    copyElement.querySelectorAll(".katex-html .base").forEach((item) => {
        if (item instanceof HTMLElement) {
            item.style.display = "initial";
        }
    });

    // 调整SVG宽度
    copyElement.querySelectorAll("mjx-container > svg").forEach((item) => {
        //暂时硬写一个数字
        item.setAttribute("width", (parseInt(item.getAttribute("width") || "50") * 8) + "px");
    });

    // 处理列表嵌套 https://github.com/siyuan-note/siyuan/issues/11276
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
            return;
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

    // 初始化MathJax
    if (typeof window.MathJax === "undefined") {
        window.MathJax = {
            svg: {
                fontCache: "none"
            },
        };
    }

    // 加载MathJax脚本
    await addScriptSync(`${Constants.PROTYLE_CDN}/js/mathjax/tex-svg-full.js`, "protyleMathJaxScript");
    await window.MathJax.startup?.promise;

    // 处理数学公式
    copyElement.querySelectorAll('[data-subtype="math"]').forEach(mathElement => {
        const node = window.MathJax.tex2svg && window.MathJax.tex2svg(Lute.UnEscapeHTMLStr(mathElement.getAttribute("data-content") || "").trim(), { display: mathElement.tagName === "DIV" });
        node?.querySelector("mjx-assistive-mml")?.remove();
        mathElement.innerHTML = node?.outerHTML || "";
    });

};

/**
 * 处理知乎的HTML预处理
 * @param copyElement 需要预处理的HTML元素
 */
const processZhihuHTML = async (copyElement: HTMLElement) => {
    // 处理链接转换为在线链接
    link2online(copyElement);

    // 处理数学公式 - 转换为图片格式
    copyElement.querySelectorAll('[data-subtype="math"]').forEach((item) => {
        // https://github.com/siyuan-note/siyuan/issues/10015
        item.outerHTML = `<img class="Formula-image" data-eeimg="true" src="//www.zhihu.com/equation?tex=" alt="${item.getAttribute("data-content")}" style="${item.tagName === "DIV" ? "display: block; max-width: 100%;" : ""}margin: 0 auto;">`;
    });

    // 处理引用块
    copyElement.querySelectorAll("blockquote").forEach((item) => {
        const elements: HTMLElement[] = [];
        processPreviewElementZhihuBlockquote(item, elements);
        elements.reverse().forEach(newItem => {
            item.insertAdjacentElement("afterend", newItem);
        });
        item.remove();
    });

    // 处理表格
    processPreviewElementsZhihuTable(copyElement);
};

export const preparePreviewHTMLForX = async (
    copyElement: HTMLElement,
    targetPlatform: Exclude<TCopyTargetPlatform, "yuque">,
)=> {
    if (targetPlatform === "mp-wechat") {
        await processWeChatHTML(copyElement);
        return;
    }
    await processZhihuHTML(copyElement);
};

export const requestYuqueMarkdown = (id: string)=> {
    return new Promise((resolve) => {
        fetchPost("/api/lute/copyStdMarkdown", {
            id,
            assetsDestSpace2Underscore: true,
            fillCSSVar: true,
            adjustHeadingLevel: true,
        }, (response) => {
            resolve(response.data || "");
        });
    });
};

export const copyPreviewHTMLToX = async (
    element: HTMLElement,
    copyElement: HTMLElement,
    id: string,
    targetPlatform?: TCopyTargetPlatform,
) => {
    if (!targetPlatform) {
        return;
    }

    if (targetPlatform === "yuque") {
        const markdown = await requestYuqueMarkdown(id);
        writeText(markdown);
        showMessage(`${siyuanI18n.pasteToYuque}`);
        return;
    }

    await preparePreviewHTMLForX(copyElement, targetPlatform);
    executeCopyOperation(element, copyElement, targetPlatform);
};
/**
 * 执行HTML复制操作
 * @param element 原始元素容器
 * @param copyElement 要复制的元素
 * @param target 复制目标平台
 */
const executeCopyOperation = (
    element: HTMLElement,
    copyElement: HTMLElement,
    target?: string,
) => {
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
    const selection = getSelection();
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
};
