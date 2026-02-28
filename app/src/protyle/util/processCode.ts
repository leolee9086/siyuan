export const processPasteCode = (html: string, text: string, originalTextHTML: string, protyle: IProtyle) => {
    const tempElement = document.createElement("div");
    tempElement.innerHTML = html;
    let isCode = false;
    if (tempElement.childElementCount === 1 &&
        (tempElement.lastElementChild as HTMLElement).style.fontFamily.indexOf("monospace") > -1) {
        // VS Code
        isCode = true;
    } else if (tempElement.childElementCount === 1 && tempElement.querySelectorAll("pre").length === 1) {
        // IDE
        isCode = true;
    } else if (tempElement.childElementCount === 1 && tempElement.firstElementChild.tagName === "TABLE" &&
        tempElement.querySelector(".line-number") && tempElement.querySelector(".line-content")) {
        // 网页源码
        isCode = true;
    } else if (originalTextHTML.indexOf('<meta name="Generator" content="Cocoa HTML Writer">') > -1 &&
        html.indexOf('\n<p class="p1">') === 0 &&
        //  ChatGPT app 目前没有此标识
        originalTextHTML.indexOf('<style type="text/css">\np.p1') > -1) {
        // Xcode
        isCode = true;
    }
    if (isCode) {
        let code = text || html;
        if (/\n/.test(code)) {
            return protyle.lute?.Md2BlockDOM(code);
        } else {
            // Paste code from IDE no longer escape `<` and `>` https://github.com/siyuan-note/siyuan/issues/8340
            code = code.replace("<", "&lt;").replace(">", "&gt;");
            return "`" + code + "`";
        }
    }
    return false;
};

