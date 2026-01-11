function 监听全局属性(属性名, 属性回调) {
    return new Promise((resolve) => {
        const 校验属性 = () => {
            if (window[属性名]) {
                属性回调();
                resolve(); // 确保在属性可用时解决 Promise
            } else {
                setTimeout(校验属性, 50); // 使用 setTimeout 并适当增加检查间隔
            }
        };
        校验属性();
    });
}
async function 注册hljs渲染选项(注册表) {
    监听全局属性('hljs', () => {
        注册自定义代码片段语言种类(注册表)
    })
}
async function 注册自定义代码片段语言种类(注册表) {

    for (const { name, baseLang, options } of 注册表) {
        try {
            注册语言变种(name, baseLang, options);
        } catch (error) {
            console.error(`Error registering language variant ${name}:`, error);
        }
    }
}
/**
 * 这个函数被用于向hljs注册新的语言变种
 * @param {*} newLangName 
 * @param {*} baseLangNameOrDefinition 
 * @param {*} callbacks 
 * @returns 
 */
async function 注册语言变种(newLangName, baseLangNameOrDefinition, callbacks) {
    let baseLanguageRules;
    if (typeof baseLangNameOrDefinition === 'string') {
        baseLanguageRules = hljs.getLanguage(baseLangNameOrDefinition);
        if (!baseLanguageRules) {
            setTimeout(() => 注册语言变种(newLangName, baseLangNameOrDefinition, callbacks), 500);
            return;
        }
    } else if (typeof baseLangNameOrDefinition === 'function') {
        baseLanguageRules = baseLangNameOrDefinition(hljs);
    }
    const newLanguageRules = function () {
        return {
            ...baseLanguageRules.rawDefinition(hljs),
            name: newLangName
        };
    };
    hljs.registerLanguage(newLangName, newLanguageRules);
    hljs.highlightAll();
    callbacks && applyCallbacks(callbacks, newLangName)
}
/**
 * 这个函数用于应用回调函数
 * onregistered 在注册完成后执行
 * publishrender 在发布模式下执行
 * editorrender 在编辑模式下执行
 * @param {*} callbacks 
 * @param {*} newLangName 
 */
const applyCallbacks = (callbacks, newLangName) => {
    callbacks.onregistered && callbacks.onregistered();
    if (callbacks.publishrender && isPublish()) {
        监听文档内容并渲染代码块(newLangName, callbacks.publishrender)
    }
    if (callbacks.editorrender && !isPublish()) {
        监听文档内容并渲染代码块(newLangName, callbacks.editorrender)
    }
}

const 应用注册表 = (注册表) => {
    if (window.hljs) {
        return 注册语言变种(注册表)
    } else {
        注册hljs渲染选项(注册表)
    }
}
const fn = (langDefine) => {

    if (Array.isArray(langDefine)) {
        应用注册表(langDefine)
    } else {
        应用注册表([langDefine])
    }
}


import { parseCDN, parseMeta } from './ParseCDN/index.js'
import * as lexer from '../utils/es-module-lexer.js'
import MagicString from '../utils/magic-string.js'
const moduleCache = []
const mjsSql = `select * from blocks where markdown like '\`\`\`mjs%'`
/**
 * 判断是否是裸导入
 * @param {*} n 
 * @returns 
 */
const isBareImport = (n) => {
    let flag = true
    if (!n) {
        return
    }
    if (n.startsWith('/')) {
        return
    }
    if (n.startsWith('http://') || n.startsWith('https://') || n.startsWith('//') || n.startsWith('file://')) {
        return
    }
    if (n.startsWith('./') || n.startsWith('../')) {
        return
    }
    if (n.startsWith('@note:')) {
        return
    }
    return flag

}
let res = await fetch('/api/query/sql', {
    method: 'post',
    body: JSON.stringify({
        stmt: mjsSql
    })
})
let json = await res.json()
json.data.forEach((block) => {
    let code = block.content
    const cdnUrls = parseCDN(code)
    //最后一个cdn有效
    const FinalCdn = cdnUrls.pop()
    //复写code中的裸导入
    let codeMagicString = new MagicString(code);
    let [imports, exports] = lexer.parse(code)
    for (let i = 0; i < imports.length; i++) {
        const {
            a,//assert, -1 for no assertion
            d,//是否动态
            e,//模块名称在语句中的结束下标
            n,//导入名称
            s,//模块名称在语句中的开始下标
            se,//导入语句在代码中的结束下标
            ss//导入语句在代码中的开始下标
        } = imports[i]
        if (n && isBareImport(n)) {
            //使用e,n,s,se,ss替换导入名
            const cdnModuleName = `${FinalCdn}${n}`
            codeMagicString.overwrite(s, e, cdnModuleName)
        }
    }
    code = `
${codeMagicString.toString()}
//# sourceURL=http://${window.location.host}/?id=${block.id}
            `
    if (parseMeta(code, 'runtime').pop() === 'webview') {

        (async () => {
            //使用一个webview来执行这个代码
            const webview = new WebView()
            code = `
<script type="module">
${code}
</script>
            `
            const blob = new Blob([code], { type: 'text/html' });

            webview.src = URL.createObjectURL(blob)
            webview.style.display = 'none'
            document.body.appendChild(webview)
            webview.addEventListener('did-finish-load', () => {
                //打开webview的控制台   
                webview.openDevTools()

            })
        })()
    } else {

        const id = block.id
        const blob = new Blob([code], { type: 'application/javascript' });

        moduleCache.push({
            code,
            dataURL: URL.createObjectURL(blob),
            id,
            name: parseMeta(code, 'module').pop() || block.name,
            alias: block.alias.split(',').concat([parseMeta(code, 'module').pop(), block.name]).filter(item => item)
        })
    }
}
)


moduleCache.forEach(item => {
    let { code, dataURL, name, alias } = item
    const [imports, exports] = lexer.parse(code)
    imports.forEach(line => {
        if (line.n && line.n.startsWith('@note:')) {
            const note = line.n.replace('@note:', '')
            if (moduleCache.filter(item => item.name === note).length === 1) {
                const codeMagicString = new MagicString(code)
                let target = moduleCache.find(item => item.name === note)
                codeMagicString.overwrite(line.s, line.e, `${target.dataURL}`)
                code = codeMagicString.toString()
                item.code = code
                const blob = new Blob([code], { type: 'application/javascript' });
                item.dataURL = URL.createObjectURL(blob)
            } else {
                if (moduleCache.filter(item => item.name === note).length > 1) {
                    console.error(`@note${item.id}: 不能有重复的模块名称${note}`)
                    console.error(moduleCache.filter(item => item.name === note).map(item => item.id).join(',') + `中重复定义了模块${note}`)
                }
                if (moduleCache.filter(item => item.name === note).length === 0) {
                    console.error(`@note${item.id}: 未找到模块名称${note}`)
                }
            }
        }
    })
})
moduleCache.forEach(item => {
    const { code, dataURL, name, alias } = item
    try {
        if (parseMeta(code, 'immediate').pop()) {
            import(dataURL)
        }
    } catch (e) {
        console.error(e)
    }
})







const 语言定义SQL = `select * from blocks where markdown like '\`\`\`sac-custom-lang%'`
fetch('/api/query/sql', {
    method: 'post',
    body: JSON.stringify({
        stmt: 语言定义SQL
    })
}).then(
    res => { return res.json() }
).then(
    json => {
        json.data.forEach(async (block) => {
            let code = block.content
            code = `
const langDefineFun = async()=>{
return ${code}
}
const langDefine = await langDefineFun()
export default langDefine
//# sourceURL=http://${window.location.host}/?id=${block.id}
            `
            const blob = new Blob([code], { type: 'application/javascript' });
            const module = await import(URL.createObjectURL(blob))
            fn(module.default)
        })
    }
)
