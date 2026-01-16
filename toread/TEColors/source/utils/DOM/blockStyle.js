import { kernelApi, plugin } from "../../asyncModules.js";
import { isPublish } from "../../utils/getFrontEnd.js"
import { 获取当前选择块元素 } from "../DOMFinder.js"
import chroma from '../../../static/chroma-js.js'

export function 清除所有已加载块元素样式(css属性名数组) {
    清除块样式(css属性名数组, 获取所有已加载块元素())
}
export function 清除可见块样式(css属性名数组) {
    清除块样式(css属性名数组, 获取所有可见块元素())
}
export function 清除选中块样式(css属性名数组) {
    清除块样式(css属性名数组, 获取当前选择块元素())
}
function 获取所有已加载块元素() {
    return Array.from(document.querySelectorAll('.protyle-wysiwyg.protyle-wysiwyg--attr [data-node-id]'))
}
function 获取所有可见块元素() {
    // 修改为只返回在屏幕上可见的块元素
    return 获取所有已加载块元素().filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);
    });
}
export function 清除块样式(css属性名数组, 块元素数组) {
    css属性名数组.forEach(
        css属性名 => {
            块元素数组.forEach(
                element => {
                    if (element.style[css属性名] && element.style[css属性名].trim() !== '') {
                        element.style[css属性名] = ''
                        !isPublish() && kernelApi.setBlockAttrs(
                            {
                                id: element.dataset.nodeId,
                                attrs: { style: element.getAttribute('style') }
                            }
                        )
                    }
                }
            )
        }
    )
}
export function 应用颜色到当前块(css属性名数组, apply = true, callback) {
    const span = document.createElement('button')
    span.setAttribute('data-type','style1')
    span.setAttribute('class', 'color__square')
    return (event) => {
        if (document.querySelector('.protyle-toolbar:not(.fn__none) [data-type="text"]')) {
            css属性名数组.forEach(
                css属性名 => {
                    if (event.target.tagName === "BUTTON") {
                        event.target.style[css属性名] && (span.style[css属性名] = event.target.style[css属性名])
                    }
                })
            let button = document.querySelector('.protyle-toolbar:not(.fn__none) [data-type="text"]')
            button.click()
            let target = document.querySelector('.protyle-util:not(.fn__none)')
            target.querySelector('[style="align-items: center"]').insertAdjacentElement('afterbegin', span)
            span.click()
            target.classList.add('fn__none')
            button.parentElement.classList.remove('fn__none')
        } else if (document.querySelector('.protyle-util:not(.fn__none)')) {
            css属性名数组.forEach(
                css属性名 => {
                    if (event.target.tagName === "BUTTON") {
                        event.target.style[css属性名] && (span.style[css属性名] = event.target.style[css属性名])
                    }
                })

            let target = document.querySelector('.protyle-util:not(.fn__none)')
            target.querySelector('[style="align-items: center"]').insertAdjacentElement('afterbegin', span)
            span.click()
            if(span.parentElement.querySelectorAll('button').length>=8){
                Array.from(span.parentElement.querySelectorAll('button')).pop().remove()
            }
        } else {
            css属性名数组.forEach(
                css属性名 => {
                    if (event.target.tagName === "BUTTON") {
                        event.target.style[css属性名] && (span.style[css属性名] = event.target.style[css属性名])
                        获取当前选择块元素().forEach(
                            element => {
                                element.style[css属性名] = event.target.style[css属性名]
                            }
                        )
                    }
                }
            )
            !isPublish() && 获取当前选择块元素().forEach(
                element => {
                    apply && kernelApi.setBlockAttrs(
                        {
                            id: element.dataset.nodeId,
                            attrs: { style: element.getAttribute('style') }
                        }
                    )
                }
            );
        }
        callback ? callback(span.getAttribute('style')) : null
    }
}
export function 计算背景并应用到当前块文字色(e) {
    const bgColor = e.target.style.backgroundColor
    const fn = (event) => 应用颜色到当前块(['color', 'backgroundColor'])(event)
    const button = document.createElement('button')
    button.style.color = bgColor
    let contrastColor = chroma(bgColor).luminance() < 0.5 ? chroma(bgColor).brighten().brighten().hex() : chroma(bgColor).darken().darken().hex();
    button.style.backgroundColor = contrastColor
    button.addEventListener('click', fn)
    button.click()
    plugin.reactiveData.recentColors.value.push(button.getAttribute("style"))

    button.remove()
}
export function 计算前景并应用到当前块背景色(e) {
    const bgColor = e.target.style.backgroundColor
    const fn = (event) => 应用颜色到当前块(['color', 'backgroundColor'])(event)
    const button = document.createElement('button')
    button.style.backgroundColor = bgColor
    let contrastColor = chroma(bgColor).luminance() < 0.5 ? chroma(bgColor).brighten().brighten().hex() : chroma(bgColor).darken().darken().hex();
    button.style.color = contrastColor
    button.addEventListener('click', fn)
    button.click()
    plugin.reactiveData.recentColors.value.push(button.getAttribute("style"))

    button.remove()

}

export function 应用到当前块文字色(e) {
    const bg = e.target.style.backgroundColor
    const fn = (event) => 应用颜色到当前块(['color'])(event)
    const button = document.createElement('button')
    button.style.color = bg
    button.addEventListener('click', fn)
    button.click()
    plugin.reactiveData.recentColors.value.push(button.getAttribute("style"))

    button.remove()
}