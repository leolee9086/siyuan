export const getGlobalMenus =()=>{
    if(!window.siyuan.menus){
        console.error(window.siyuan)
        throw ("全局菜单不存在")
    }
    return window.siyuan.menus
}