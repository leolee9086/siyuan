import { plugin } from "../../../utils/pluginSymbolRegistry.js"
export const 编辑器菜单 = {
    registMenuItem: (menuItemOptions) => {
        console.log(plugin.eventBus)
        const eventBus = plugin.eventBus
        eventBus.on(
            "click-editortitleicon", (e) => {
                if (menuItemOptions.判定函数) {
                    console.log(e,menuItemOptions)
                    let result = menuItemOptions.判定函数(e)
                    result && e.detail.menu.addItem(
                        {
                            label:menuItemOptions.label,
                            icon:menuItemOptions.icon,
                            click:(...args)=>{
                                menuItemOptions.click(e,...args)
                            }
                        }
                    )
                } else {
                    e.detail.menu.addItem(
                        {
                            label:menuItemOptions.label,
                            icon:menuItemOptions.icon,
                            click:(...args)=>{
                                menuItemOptions.click(e,...args)
                            }
                        }
                    )
                }
            }
        )
    }
}