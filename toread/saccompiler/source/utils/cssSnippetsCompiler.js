import kernelApi from "../polyfills/kernelApi.js";
import {default as 核心api} from '../polyfills/kernelApi.js';

// 获取文档内容
export const getDocumentContent = async (id) => {
    kernelApi.pushMsg({
        msg: `正在获取${id}的内容`
    });
    let doc = kernelApi.getDoc.sync({ id });
    kernelApi.pushMsg({
        msg: `正在解析${id}的内容`
    });
    return doc.content;
};

// 解析文档并提取指定语言的内容
export const extractContentByLanguage = (content, language) => {
    let extractedContent = "";
    let parser = new DOMParser(); // 创建DOMParser实例
    let docDOM = parser.parseFromString(content, "text/html"); // 解析DOM字符串

    // 处理块引用
    docDOM.querySelectorAll('[data-type="block-ref"]').forEach((ref) => {
        ref.innerText = ref.getAttribute("data-id");
    });

    // 提取指定语言的代码块
    let codeBlocks = docDOM.querySelectorAll("div[data-node-id]:not(div[data-node-id] div[data-node-id])");
    codeBlocks.forEach((el) => {
        if (el.querySelector(".protyle-action__language") && [language].includes(el.querySelector(".protyle-action__language").innerHTML)) {
            extractedContent += el.querySelector(".hljs").innerText;
        }
    });

    return extractedContent;
};

// 组合使用上述函数以获取并解析文档内容，提取CSS
export const 获取笔记css内容 = async (id) => {
    let content = await getDocumentContent(id);
    return extractContentByLanguage(content,'css');
};
export const 添加当前文档css =async(文档id)=>{
    let 文档内容 = await 核心api.getDoc(
        { id: 文档id, mode: 0, size: 102400, k: "" },
        ""
    );
    let 文档属性 = await 核心api.getDocInfo(
        { id: 文档id, mode: 0, size: 102400, k: "" },
        ""
    );
    let div = document.createElement("div");
    div.innerHTML = 文档内容.content;
    let codeBlocks = div.querySelectorAll(
        "div[data-node-id]:not(div[data-node-id] div[data-node-id])"
    );
    div.querySelectorAll('[data-type="block-ref"]').forEach((ref) => {
        ref.innerText = ref.getAttribute("data-id");
    });

    let code = "";
    codeBlocks.forEach((el) => {
        if (
            el.querySelector(".protyle-action__language") &&
            ["css","CSS"].indexOf(
                el.querySelector(".protyle-action__language").innerHTML
            ) >= 0
        ) {
            let cssCode = el.querySelector(".hljs").innerText;
                code += cssCode+"\n"
            
        } else {
            let textels = el.querySelectorAll(`div[contenteditable="true"]`);
            textels.forEach((child) => {
                let text = child.innerText;
                let textArray = text.split(/\r\n|\n|\r/);
                textArray.forEach((line) => {
                        code += "/*" + line +"*/\n";
                });
            });
        }
    });
    code = `/*siyuan://blocks/${文档属性.id}*/\n` + code;
    if (window.location.href.indexOf("?") >= 0) {
        code =
            `/*${window.location.href.replace("app", "desktop")}&&blockID=${文档属性.id
            }*/\n` + code;
    } else {
        code =
            `/*${window.location.href.replace("app", "desktop")}?blockID=${文档属性.id
            }*/\n` + code;
    }
    code = `/*${文档属性.name}*/\n` + code;
    let 现有代码片段 = await 核心api.getSnippet({ type: "all", enabled: 2 });
    let 代码片段id = 文档id+"css"
    let 存在元素索引 = 现有代码片段.snippets.findIndex((item) => {
        return item.id === 代码片段id;
    });
    if(存在元素索引>=0){
        现有代码片段.snippets[存在元素索引].content = code;
        现有代码片段.snippets[存在元素索引].name =  文档id;
    }else {
        // 否则添加新元素
        现有代码片段.snippets.push({
            id: 文档id + "css",
            content: code,
            name: 文档id,
            type: "css",
            enabled: true,
        });
    }
    await 核心api.setSnippet(现有代码片段);
}