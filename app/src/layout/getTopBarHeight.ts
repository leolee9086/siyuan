/** 获取菜单定位时应避让的顶部区域高度；独立入口没有布局栏时返回 0。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const getTopBarHeight = () => {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        return 0;
    }
    const toolbar = document.getElementById("toolbar");
    if (toolbar) {
        return toolbar.clientHeight;
    }
    const tabBar = document.querySelector<HTMLElement>(".layout-tab-bar");
    return tabBar?.clientHeight || 0;
};
