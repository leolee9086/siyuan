export async function 创建编辑器上下文() {
    let { pos, editableElement, blockElement } = 获取光标所在位置();
    if (!editableElement) {
        return null;
    }

    // 直接异步获取分词结果
    const tokens = await 使用结巴拆分块元素(blockElement);
    // 直接异步获取当前光标所在分词结果
    const 当前光标所在分词结果 = await 获取当前光标所在分词结果(tokens, pos);
    let context = {
        position: pos,
        text: editableElement.innerText,
        tokens, // 直接赋值
        blockID: blockElement.getAttribute('data-node-id'),
        //  editableElement,
        currentToken: 当前光标所在分词结果, // 直接赋值
        blockDOM: blockElement.outerHTML,
        id: Lute.NewNodeID()
    };
    return context
}

import { pluginInstance as plugin } from "../asyncModules.js";
import { findTokenElement } from "../UI/tokenMenu.js";

export function 获取光标所在位置() {
    let 空位置 = { pos: null, element: null };
    // 获取选区对象
    const selection = window.getSelection();
    if (!selection) return 空位置;
    // 获取选区范围
    let range;
    try {
        range = selection.getRangeAt(0);
        if (!range) return 空位置;
    } catch (e) {
        return 空位置;
    }
    // 找到离范围最近的可编辑祖先元素
    let current = range.commonAncestorContainer;
    while (current !== document) {
        if (current.nodeType === 1 && current.getAttribute("contenteditable")) {
            break;
        }
        current = current.parentNode;
    }
    // 限制范围在可编辑祖先内
    const limitedRange = plugin.选区处理器.获取元素内文字选区偏移(current);
    const tokenElement = findTokenElement(current, range);
    return {
        pos: limitedRange,
        editableElement: current,
        blockElement: plugin.DOM查找器.hasClosestBlock(current),
        parentElement: tokenElement,
        range: range
    };
}

export function 获取选区屏幕坐标(nodeElement, range) {
    if (!range) {
        range = getEditorRange(nodeElement);
    }
    if (!nodeElement.contains(range.startContainer)) {
        return {
            left: 0,
            top: 0,
        };
    }
    let cursorRect;
    if (range.getClientRects().length === 0) {
        if (range.startContainer.nodeType === 3) {
            // 空行时，会出现没有 br 的情况，需要根据父元素 <p> 获取位置信息
            const parent = range.startContainer.parentElement;
            if (parent && parent.getClientRects().length > 0) {
                cursorRect = parent.getClientRects()[0];
            } else {
                return {
                    left: 0,
                    top: 0,
                };
            }
        } else {
            const children = range.startContainer.children;
            if (
                children[range.startOffset] &&
                children[range.startOffset].getClientRects().length > 0
            ) {
                // markdown 模式回车
                cursorRect = children[range.startOffset].getClientRects()[0];
            } else if (range.startContainer.childNodes.length > 0) {
                // in table or code block
                const cloneRange = range.cloneRange();
                range.selectNode(
                    range.startContainer.childNodes[Math.max(0, range.startOffset - 1)]
                );
                cursorRect = range.getClientRects()[0];
                range.setEnd(cloneRange.endContainer, cloneRange.endOffset);
                range.setStart(cloneRange.startContainer, cloneRange.startOffset);
            } else {
                cursorRect = range.startContainer.getClientRects()[0];
            }
            if (!cursorRect) {
                let parentElement = range.startContainer.childNodes[range.startOffset];
                if (!parentElement) {
                    parentElement =
                        range.startContainer.childNodes[range.startOffset - 1];
                }
                if (!parentElement) {
                    cursorRect = range.getBoundingClientRect();
                } else {
                    while (
                        !parentElement.getClientRects ||
                        (parentElement.getClientRects &&
                            parentElement.getClientRects().length === 0)
                    ) {
                        parentElement = parentElement.parentElement;
                    }
                    cursorRect = parentElement.getClientRects()[0];
                }
            }
        }
    } else {
        const rects = range.getClientRects(); // 由于长度过长折行，光标在行首时有多个 rects https://github.com/siyuan-note/siyuan/issues/6156
        return {
            // 选中多行不应遮挡第一行 https://github.com/siyuan-note/siyuan/issues/7541
            left: rects[rects.length - 1].left,
            top: rects[0].top,
        };
    }
    return {
        left: cursorRect.left,
        top: cursorRect.top,
    };
}

// 辅助方法,限制范围在指定元素内
export function 获取元素内文字选区偏移(element) {
    let caretOffset = 0;
    const doc = element.ownerDocument || element.document;
    const win = doc.defaultView || doc.parentWindow;
    let sel;
    if (typeof win.getSelection != "undefined") {
        sel = win.getSelection();
        if (sel.rangeCount > 0) {
            const range = win.getSelection().getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            caretOffset = preCaretRange.toString().length;
        }
    } else if ((sel = doc.selection) && sel.type != "Control") {
        const textRange = sel.createRange();
        const preCaretTextRange = doc.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint("EndToEnd", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}
import { clientApi, pluginInstance as plugin } from "../asyncModules.js";
import { 获取光标所在位置 } from "../utils/rangeProcessor.js";
import { 使用结巴拆分元素 } from "../utils/tokenizer.js";
import { 智能防抖 } from "../utils/functionTools.js"
import { 根据上下文获取动作表 } from '../actionList/getter.js'
import kernelApi from "../polyfills/kernelApi.js";
import { Context } from "./Context.js";
import buildMenu from './dialogs/fakeMenu.js'
import { logger } from "../logger/index.js";
import { 设置对话框 } from "./dialogs/settingsDialog.js";
export { 根据上下文获取动作表 as 根据上下文获取动作表 }

plugin.eventBus.on(
    "settingChange", (e) => {
        let tokenMenuDialogs = plugin.statusMonitor.get('菜单', '关键词菜单', '菜单实例').$value
        let { detail } = e
        if (detail.name === "动作设置.关闭动作监听") {
            if (detail.value) {
                tokenMenuDialogs[0].destroy()
            } else {
                buildMenu("SAC")
            }
        }
    }
)
function 获取元素所在protyle(element) {
    let { protyles } = plugin
    logger.tokenmenulog(protyles)
    return protyles.find(protyle => {
        return protyle.contentElement ? protyle.contentElement.contains(element) : protyle.protyle.contentElement.contains(element)
    })
}
let isComposing = false;
//这一段是token菜单的渲染逻辑
//记录选区位置,如果发生了变化就不再执行后面的逻辑
let controller = new AbortController();
let signal = controller.signal

let 显示token菜单 = (e, signal) => {
    let tokenMenuDialogs = plugin.statusMonitor.get('菜单', '关键词菜单', '菜单实例').$value
    if (!tokenMenuDialogs[0]) {
        return
    }
    let tokenMenuDialog = tokenMenuDialogs[0]
    tokenMenuDialog.clear()
    //上下方向键不重新渲染菜单
    if (signal.aborted) {
        return
    }
    if (!plugin.块数据集) {
        return
    }
    //如果不是在编辑器里就不渲染了
    const 最近块元素 = plugin.DOM查找器.hasClosestBlock(
        getSelection().getRangeAt(0).commonAncestorContainer
    );
    if (!最近块元素) {
        return
    }
    let block = new plugin.utils.BlockHandler(最近块元素.dataset.nodeId)
    //这个是用来获取光标处token的
    let { pos, editableElement, blockElement, parentElement } = 获取光标所在位置();
    let 分词结果数组 = 使用结巴拆分元素(editableElement).filter((token) => {
        return (token.start <= pos && token.end >= pos) && (token.word && token.word.trim().length > 1);
    }).sort((a, b) => {
        return b.word.length - a.word.length
    });
    if (!分词结果数组[0]) {
        return
    }
    分词结果数组.pos = pos
    分词结果数组.editableElement = editableElement
    分词结果数组.parentElement = parentElement
    分词结果数组.blockElement = blockElement
    分词结果数组.protyle = 获取元素所在protyle(blockElement)
    if (!获取光标底部位置()) {
        return
    }
    const range = getSelection().getRangeAt(0);
    const 选区位置 = plugin.选区处理器.获取选区屏幕坐标(最近块元素, range);
    plugin.lastTokenArray = 分词结果数组
    //创建一个临时文档片段元素以加快渲染速度
    分词结果数组.forEach(
        async (分词结果) => {
            let 执行上下文 = new Context([block], 分词结果, 获取元素所在protyle(最近块元素).getInstance(), tokenMenuDialog, plugin, kernelApi, clientApi, 'blockAction_token', 分词结果数组)
            let 备选动作表 = await 根据上下文获取动作表(执行上下文, signal)
            //这一步排序对性能的影响微乎其微
            let 菜单动作表 = 备选动作表.filter(item => { return item.hintAction })
            let tips动作表 = 备选动作表.filter(item => { return item.tipRender })
            plugin.eventBus.emit('hint_tips', { 备选动作表: tips动作表, context: 执行上下文 })
            let 动作菜单组 = 根据动作序列生成菜单组(菜单动作表, 执行上下文, '分词菜单')
            tokenMenuDialog.moveTo({
                x: 选区位置.left + 10,
                y: 获取光标底部位置(),
                isLeft: false,
            })

            tokenMenuDialog.element.querySelector("#sacmenu").appendChild(动作菜单组)
        }
    )
}

export function findTokenElement(current, range) {
    if (current.nodeType === 1 && current.classList.contains("token")) {
        return current;
    }
    if (current.childNodes.length > 0) {
        for (let i = 0; i < current.childNodes.length; i++) {
            const child = current.childNodes[i];
            const tokenElement = findTokenElement(child, range);
            if (tokenElement) {
                return tokenElement;
            }
        }
    }
    if (range.startContainer === current || range.endContainer === current) {
        return current.parentElement;
    }
    return null;
}
function 获取光标底部位置() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const rect = range.getClientRects()[0];
    return rect ? rect.bottom : null;
}




const 根据上下文生成动作菜单项 = (执行上下文, 动作, 触发事件类型) => {
    let 菜单项文字内容 = 动作.label[window.siyuan.config.lang] || 动作.label.zh_CN || 动作.label
    if (菜单项文字内容 instanceof Function) {
        菜单项文字内容 = 动作.label(执行上下文)
        菜单项文字内容 = 菜单项文字内容[window.siyuan.config.lang] || 菜单项文字内容.zh_CN || 菜单项文字内容
    }
    let span = `<svg class="b3-menu__icon" style="">
  <use xlink:href="#${Lute.EscapeHTMLStr(动作.icon)}"></use>
</svg>
<span class="b3-menu__label"
style='  display: inline-block;
width: 200px; 
white-space: nowrap; 
overflow: hidden;
text-overflow: ellipsis; 

'
>${菜单项文字内容}</span>`
    let div = `<div><svg class="b3-menu__icon" style="">
<use xlink:href="#${Lute.EscapeHTMLStr(动作.icon)}"></use>
</svg>
<span class="b3-menu__label"
style='  display: inline-block;
width: 200px; 
white-space: nowrap; 
overflow: hidden;
text-overflow: ellipsis; 

'
>${菜单项文字内容}</span></div> <div class="b3-label__text">${动作.describe}</div>}`
    let 菜单项元素 = 以tag名生成元素(
        'button',
        {
            class: "b3-menu__item"
        },
        动作.describe ? div : span
        ,
        {
            click: () => { 执行动作(动作, 执行上下文, 触发事件类型) },
            contextmenu: () => {
                let list = {}
                list[动作.provider] = true
                设置对话框(list, `动作设置.关键词动作设置`)
            }
        }
    )
    菜单项元素.token = 执行上下文.token
    菜单项元素.active = 动作.active
    菜单项元素.deactive = 动作.deactive
    菜单项元素.runAction = () => {
        执行动作(动作, 执行上下文, '分词菜单')
    }
    return 菜单项元素
}
const 执行动作 = async (动作, 执行上下文, 触发事件类型) => {
    if (触发事件类型 == '分词菜单') {
        if (动作.hintAction) {
            await 动作.hintAction(执行上下文);
        } else if (动作.分词动作) {
            await 动作.分词动作(执行上下文);
        }
    } else {
        if (动作.blockAction) {
            await 动作.blockAction(执行上下文);
        } else if (动作.块动作) {
            await 动作.块动作(执行上下文);
        }
    }
    plugin.命令历史.push(动作);
    动作.lastContext = 执行上下文;
}
//对命令进行排序
//Levenshtein距离是一种用于计算两个字符串之间的相似度的算法。
//它衡量了将一个字符串转换为另一个字符串所需的最少编辑操作次数，包括插入、删除和替换字符。
export function 根据动作序列生成菜单组(动作序列, 执行上下文, 触发事件类型) {
    let 子菜单元素片段 = document.createDocumentFragment();
    动作序列.forEach(
        (动作) => {
            try {
                let 动作菜单项 = 根据上下文生成动作菜单项(执行上下文, 动作, 触发事件类型)
                //如果动作曾经执行缓慢,就给个提示
                if (plugin.statusMonitor.get('动作表状态', 动作._provider).$value === "slow") {
                    动作菜单项.style.color = '--b3-card-warning-color'
                }
                子菜单元素片段.appendChild(动作菜单项)
            } catch (e) {
                logger.tokenmenuerror(执行上下文, 动作, e)
            }
        }
    )
    return 子菜单元素片段
}
function 以tag名生成元素(tag名, 属性配置, 内部html, 事件配置) {
    let 元素 = document.createElement(tag名)
    Object.getOwnPropertyNames(属性配置).forEach(
        prop => {
            元素.setAttribute(prop, 属性配置[prop])
        }
    )
    Object.getOwnPropertyNames(事件配置).forEach(
        事件名 => {
            元素.addEventListener(事件名, 事件配置[事件名])
        }
    )
    元素.insertAdjacentHTML('beforeEnd', 内部html)
    return 元素
}
export const 开始渲染 = () => {
    buildMenu("SAC")
    document.addEventListener('compositionstart', () => {
        //isComposing = true;
    },
        { capture: true });
    document.addEventListener(
        "keydown",
        (e) => {
            controller.abort()
            controller = new AbortController();
            signal = controller.signal
            let tokenMenuDialogs = plugin.statusMonitor.get('菜单', '关键词菜单', '菜单实例').$value
            if (!tokenMenuDialogs[0]) {
                return
            }
            let tokenMenuDialog = tokenMenuDialogs[0]
            if (e.code && (e.code === "ArrowUp" || e.code === "ArrowDown")) {
                let altFlag = !plugin.configurer.get('动作设置', '上下键选择动作').$value ? e.altKey : !e.altKey
                if (altFlag && !e.repeat) {
                    tokenMenuDialog.switchCurrent(e.code)
                    e.preventDefault()
                    e.stopPropagation()
                    return
                }
            }

            if (e.code && (e.code === "Space" && plugin.configurer.get('动作设置', '空格键调用动作').$value)) {
                console.log(e)

                let items = Array.from(tokenMenuDialog.element.querySelectorAll('.b3-menu__item'));
                let currentIndex = items.findIndex(item => item.classList.contains('b3-menu__item--current'));
                // 如果有选中的菜单项
                if (currentIndex !== -1) {
                    // 触发选中的菜单项
                    items[currentIndex].click();
                    e.preventDefault();
                    e.stopPropagation();
                }
                tokenMenuDialog.clear()
            }
            if (e.code === "Enter" && e.altKey) {
                let items = Array.from(tokenMenuDialog.element.querySelectorAll('.b3-menu__item'));
                let currentIndex = items.findIndex(item => item.classList.contains('b3-menu__item--current'));
                // 如果有选中的菜单项
                if (currentIndex !== -1) {
                    // 触发选中的菜单项
                    items[currentIndex].click();
                    e.preventDefault();
                    e.stopPropagation();
                }
                tokenMenuDialog.clear()
            }
            if (!isComposing) {
                // 触发事件的逻辑
                setTimeout(() => {
                    显示token菜单(e, signal)
                }, 0)
            }
        },
        { capture: true }
    )
    // 监听 compositionend 事件
    document.addEventListener('compositionend', (e) => {
        let tokenMenuDialogs = plugin.statusMonitor.get('菜单', '关键词菜单', '菜单实例').$value
        if (!tokenMenuDialogs[0]) {
            return
        }
        let tokenMenuDialog = tokenMenuDialogs[0]
        isComposing = false;
        controller.abort()
        controller = new AbortController();
        signal = controller.signal
        if (!tokenMenuDialog) {
            return
        }
        setTimeout(() => {
            显示token菜单(e, signal)
        }, 0)

    },
        { capture: true });
}

import * as jieba from '../../../static/jieba_rs_wasm.js'
import { 创建token对象 } from "../DOMTokenizer.js";
import { 校验分词是否连续, 校验是否包含 } from './utils.js';
import fs from '../../polyfills/fs.js';
//结巴的初始化会造成问题
await jieba.default(import.meta.resolve('../../../static/jieba_rs_wasm_bg.wasm'))
let dict
try {
    try {
        dict = await fs.readFile('/data/public/sac-tokenizer/dict.txt')
        dict = dict.split('\n')
        dict.forEach(
            word => {
                word && jieba.add_word(word)
            }
        )
    } catch (e) {
        console.warn(e)
    }

} catch (e) {
    console.warn(e)
}

jieba.add_word('思源笔记')
jieba.add_word('链滴')
export { jieba as jieba }
export { jieba as 结巴 }
export { dict as dict }
let tokenize = jieba.tokenize
export { tokenize as tokenize }
export async function 使用结巴拆分块元素(element) {
    //首先用结巴进行全分词
    let 分词结果数组 = await tokenize(element.textContent, "search")
    //然后对分词产生的每一个结果创建range
    let tokens = []
    for (let 分词结果 of 分词结果数组) {
        let token = await 创建token对象(element, 分词结果)
        tokens.push(token)
    }
    //创建token之间的父子关系和前后关系
    await 处理分词对象(tokens)
    return tokens
}
function 处理分词对象(分词对象序列) {
    分词对象序列.forEach((当前分词对象, i) => {
        let foundNext = false;
        for (let j = i + 1; j < 分词对象序列.length; j++) {
            const 下一个分词对象 = 分词对象序列[j];
            if (!foundNext && 校验分词是否连续(当前分词对象, 下一个分词对象)) {
                当前分词对象.next = 下一个分词对象.id;
                下一个分词对象.pre = 当前分词对象.id;
                foundNext = true;
            }
            if (校验是否包含(当前分词对象, 下一个分词对象)) {
                当前分词对象.children = 当前分词对象.children || [];
                当前分词对象.children.push(下一个分词对象);
            }
        }
    });
}

import { sac } from '../../asyncModules.js';
import { 获取光标所在位置 } from '../rangeProcessor.js';
import { 使用结巴拆分块元素 } from '../tokenizer/jieba.js';
import { 获取当前光标所在分词结果 } from '../rangeProcessor.js';
// 通用逻辑函数
/*export async function 创建编辑器上下文() {
  let { pos, editableElement, blockElement } = 获取光标所在位置();
  if (!editableElement) {
    return null;
  }
  // 使用代理延迟分词结果的生成，并确保结果生成后不再变化
  const 分词结果代理 = new Proxy({}, {
    get: async (target, property) => {
      if (property === 'tokens' && !target.tokens) {
        target.tokens = await 使用结巴拆分块元素(blockElement);
      }
      if (property === '当前光标所在分词结果' && !target.当前光标所在分词结果) {
        target.当前光标所在分词结果 = await 获取当前光标所在分词结果(target.tokens, pos);
      }
      return target[property];
    }
  });
  
  return {
    position: pos,
    text: editableElement.innerText,
    get tokens() {
      return 分词结果代理.tokens;
    },
    blockID: blockElement.getAttribute && blockElement.getAttribute('data-node-id'),
    editableElement,
    logger: sac.logger,
    get currentToken() {
      return 分词结果代理.当前光标所在分词结果;
    }
  };
}*/


export async function 创建编辑器上下文() {
    let { pos, editableElement, blockElement } = 获取光标所在位置();
    if (!editableElement) {
        return null;
    }

    // 直接异步获取分词结果
    const tokens = await 使用结巴拆分块元素(blockElement);
    // 直接异步获取当前光标所在分词结果
    const 当前光标所在分词结果 = await 获取当前光标所在分词结果(tokens, pos);
    let context = {
        position: pos,
        text: editableElement.innerText,
        tokens, // 直接赋值
        blockID: blockElement.getAttribute('data-node-id'),
        //  editableElement,
        currentToken: 当前光标所在分词结果, // 直接赋值
        blockDOM: blockElement.outerHTML,
        id: Lute.NewNodeID()
    };
    return context
}