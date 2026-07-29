/**
 * Composer 菜单使用视口坐标定位，必须直接挂到 body。
 * 带有 backdrop-filter 的宿主会成为 fixed containing block，留在宿主内会重复叠加坐标并撑大滚动区域。
 */
export const mountComposerViewportOverlay = (element: HTMLElement): void => {
    document.body.append(element);
};

export const unmountComposerViewportOverlay = (element: HTMLElement): void => {
    element.remove();
};
