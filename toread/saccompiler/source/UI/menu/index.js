import { 编辑器菜单 } from './controller/index.js'
import { 编辑器菜单内容 } from './editortitleicon/index.js'
编辑器菜单内容.forEach(
    菜单项目=>
    编辑器菜单.registMenuItem(菜单项目)
)
export {编辑器菜单 as 编辑器菜单} 
