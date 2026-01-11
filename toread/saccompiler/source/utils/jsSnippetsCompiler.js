import * as lexer from './es-module-lexer.js'
import MagicString from "./magic-string.js"
import {default as 核心api} from '../polyfills/kernelApi.js';
import { 重写导入 } from './moduleLexer.js';
async function 关闭文档js代码片段() {
    let 文档id = 自定义菜单.编辑器菜单.菜单状态.当前块id;
    let 代码片段id = 文档id + "js";
    let 现有代码片段 = await 核心api.getSnippet({ type: "all", enabled: 2 });
    let 序号 = 现有代码片段.snippets.findIndex((item) => {
        return item.id === 代码片段id;
    });
    现有代码片段.snippets[序号].enabled = false;
    await 核心api.setSnippet(现有代码片段);
    window.location.reload();
}
export  async function 删除笔记代码片段(文档id) {
    let 代码片段id = 文档id + "js";
    let 现有代码片段 = await 核心api.getSnippet({ type: "all", enabled: 2 });
    let 序号 = 现有代码片段.snippets.findIndex((item) => {
        return item.id === 代码片段id;
    });
    现有代码片段.slice(序号,1)
    await 核心api.setSnippet(现有代码片段);
 //   window.location.reload();
}
export async function 运行当前文档为js(文档id,直接运行) {
    
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
            ["js", "javascript"].indexOf(
                el.querySelector(".protyle-action__language").innerHTML
            ) >= 0
        ) {
            code += el.querySelector(".hljs").innerText;
        } else if (
            el.querySelector(".protyle-action__language") &&
            ["css"].indexOf(
                el.querySelector(".protyle-action__language").innerHTML
            ) >= 0
        ) {
            let cssCode = el.querySelector(".hljs").innerText;
            if (cssCode.startsWith("/*cssInJS*/")) {
                let htmlcode = `<style>${cssCode}</style>`;
                code += `\ndocument.head.insertAdjacentHTML('beforeend',\`${htmlcode}\`);\n`;
            }
        } else {
            let textels = el.querySelectorAll(`div[contenteditable="true"]`);
            textels.forEach((child) => {
                let text = child.innerText;
                let textArray = text.split(/\r\n|\n|\r/);
                textArray.forEach((line) => {
                    if (!line.startsWith("@js:import")) {
                        code += "//" + line + "\n";
                    } else {
                        code += line.replace("@js:", "") + "\n";
                    }
                });
            });
        }
    });
    code = 解析导入(code);
    code = `//siyuan://blocks/${文档属性.id}\n` + code;
    if (window.location.href.indexOf("?") >= 0) {
        code =
            `//${window.location.href.replace("app", "desktop")}&&blockID=${文档属性.id
            }\n` + code;
    } else {
        code =
            `//${window.location.href.replace("app", "desktop")}?blockID=${文档属性.id
            }\n` + code;
    }
    code = `//${文档属性.name}\n` + code;
    let id文件名 =文档属性.name+"_"+文档属性.id
    let blob = new Blob([code], {
        type: "application/javascript",
    });
    let path = "/data/snippets/jsInNote/" +id文件名 + ".js";

    let file = new File([blob], id文件名 + ".js", {
        lastModified: Date.now(),
    });

    let data = new FormData();
    data.append("path", path);
    data.append("file", file);
    data.append("isDir", false);
    data.append("modTime", Date.now());
    let res = await fetch("/api/file/putFile", {
        method: "POST",
        body: data,
    });
    let resdata = await res.json();
    if (resdata.code === 0) {
        await 核心api.pushMsg({
            msg: `${文档属性.id}已经导出到${"/data/snippets/jsInNote/" + id文件名 + ".js"
                }`,
        });
        if (直接运行) {
            await 添加笔记内js代码片段(文档属性.id, 文档属性.name, "js");
        }
    } else {
        await 核心api.pushErrMsg({
            msg: `${文档属性.id}导出为js出错:${resdata.msg}`,
        });
        console.error(`${文档属性.id}导出为js出错:${resdata.msg}`);
    }
}


async function 添加笔记内js代码片段(id, 名称, 类型) {
    let 代码片段内容 = `import('/snippets/jsInNote/${名称+"_"+id + ".js"}')`;
    let 现有代码片段 = await 核心api.getSnippet({ type: "all", enabled: 2 });
    let 存在元素索引 = 现有代码片段.snippets.findIndex(
        (item) => item.id === id + "js"
    );
    if (存在元素索引 >= 0) {
        // 如果元素已存在，则替换元素value
        现有代码片段.snippets[存在元素索引].content = 代码片段内容;
        现有代码片段.snippets[存在元素索引].name = 名称;
        现有代码片段.snippets[存在元素索引].type = 类型;

        if (现有代码片段.snippets[存在元素索引].enabled) {
            await 核心api.setSnippet(现有代码片段);
            window.location.reload();
        } else {
            现有代码片段.snippets[存在元素索引].enabled = true;
            await 核心api.setSnippet(现有代码片段);
            document.head.appendChild(
                生成元素(
                    "script",
                    {
                        id: `snippetJS${id}`,
                        type: "text/javascript",
                    },
                    代码片段内容
                )
            );
        }
    } else {
        // 否则添加新元素
        现有代码片段.snippets.push({
            id: id + "js",
            content: 代码片段内容,
            name: 名称,
            type: 类型,
            enabled: true,
        });
        await 核心api.setSnippet(现有代码片段);
        document.head.appendChild(
            生成元素(
                "script",
                {
                    id: `snippetJS${id}`,
                    type: "text/javascript",
                },
                代码片段内容
            )
        );
    }
}




function 解析导入(code) {
    let [imports, exports] = lexer.parse(code);
    let codeMagicString = new MagicString(code);
    imports.forEach((导入声明) => {
        导入声明.n ? codeMagicString.overwrite(导入声明.s, 导入声明.e, 重写导入(导入声明)) : null;
    });
    return codeMagicString.toString();
}
function 生成元素(标签, 属性对象, 内容) {
    let 元素 = document.createElement(标签);
    Object.getOwnPropertyNames(属性对象).forEach((属性名) =>
        元素.setAttribute(属性名, 属性对象[属性名])
    );
    元素.innerHTML = 内容;
    return 元素;
}