import kernelApi from "../../../polyfills/kernelApi.js";
import { 获取笔记css内容 } from "../../../utils/cssSnippetsCompiler.js";
import { 删除笔记代码片段, 运行当前文档为js } from "../../../utils/jsSnippetsCompiler.js";
import { 添加当前文档css } from "../../../utils/cssSnippetsCompiler.js";
import { plugin,clientApi } from "../../../asyncModules.js";
export const 编辑器菜单内容 = [
    {
        //id: "运行笔记",
        label: "运行到代码片段(js)",
        icon: "iconCode",
        判定函数: (e) => {
            return !document.querySelector(
                `script[id="snippetJS${e.detail.data.id}js"]`
            );
        },
        click: (menuContextEvent, menuItemElement, clickEvent) => {
            let id = menuContextEvent.detail.data.id
            运行当前文档为js(id, true);
        },
    },
    {
        label:"保存笔记为AI提示词",
        icon:"iconSparkles",
        click:(e)=>{
            let localStorage = kernelApi.getLocalStorage.sync({app:siyuan.ws.app.appId,key:"local-ai"})
            let localAI = localStorage['local-ai']
            let currentDocPrompt= localAI.find(
                item=>{
                    return item.name ===e.detail.data.name
                }
            )
            if(currentDocPrompt){
            currentDocPrompt.memo=kernelApi.exportMdContent.sync({id:e.detail.data.id}).content
            }else{
                localAI.push({
                    memo:kernelApi.exportMdContent.sync({id:e.detail.data.id}).content,
                    name:e.detail.data.name
                })
            }
            kernelApi.setLocalStorageVal.sync(
                {
                    app:siyuan.ws.app.appId,
                    key:"local-ai",
                    val:localAI
                }
            )
        
        },

    },
    {
        id: "运行笔记",
        label: "关闭笔记代码片段(js)",
        icon: "iconCode",
        判定函数: (e) => {
            return document.querySelector(
                `script[id="snippetJS${e.detail.data.id}js"]`
            );
        },
        click: () => {
            window.location.reload()
        },
    },
    {
        id: "删除笔记代码片段",
        label: "删除笔记代码片段(js)",
        icon: "iconCode",
        判定函数:(e)=>{
            return document.querySelector(
                `script[id="snippetJS${e.detail.data.id}js"]`
            );
        },
        click:async(e)=>{
            let 代码片段id = `${e.detail.data.id}js`
            let 现有代码片段 = await kernelApi.getSnippet({ type: "all", enabled: 2 });
            let 序号 = 现有代码片段.snippets.findIndex((item) => {
                return item.id === 代码片段id;
            });
            let 用户确认结果 = clientApi.confirm(
                "确认删除?",
                "删除代码片段无法撤销,请确认你是否要删除它",
                async () => {
                  用户确认结果 = true;
                  现有代码片段.snippets.splice(序号, 1);
                  document.querySelector(
                    `script[id="snippetJS${e.detail.data.id}js"]`
                ).remove();
                  await kernelApi.setSnippet(现有代码片段);
                  window.location.reload();
                },
                () => {
                  用户确认结果 = false;
                }
              );
             if(用户确认结果){
                await 删除笔记代码片段(e.detail.data.id)
             }
        }
    },
    {
        id: "添加样式",
        label: "添加笔记css到代码片段(css)",
        icon: "iconCode",
        判定函数: (e) => {
            return !document.querySelector(
                `style[id="snippetCSS${e.detail.data.id}css"]`
            );
                },
        click: (e) => {
            添加当前文档css(e.detail.data.id)
        }
    },
    {
        id: "测试样式",
        label: "测试css,一秒钟之后移除",
        icon: "iconcode",
        判定函数: (e) => {
            return true
        },
        click: async(e) => {
            let id = e.detail.data.id
            let cssElement = document.createElement("style")
            cssElement.innerHTML=await 获取笔记css内容(id)
            document.head.appendChild(cssElement)
            setTimeout(
                ()=>{
                    kernelApi.pushMsg({
                        msg: `${id}的css内容测试完成`
                    })
                    cssElement.remove()
                }
            ,1000)
        }
    }
]