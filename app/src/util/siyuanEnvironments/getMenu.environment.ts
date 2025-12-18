export const getSiyuanGlobalMenus = () => {
    if (!window.siyuan.menus) {
        console.error(window.siyuan);
        throw ("全局菜单不存在");
    }
    return window.siyuan.menus;
};

export const getSiyuanGlobalMenusMenu = () => {
    return getSiyuanGlobalMenus().menu;
};