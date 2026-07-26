/** 移动键盘工具栏跨事件、计时器和原生桥接调用共享的完整生命周期状态。 */
export interface MobileKeyboardLifecycleState {
    lockUntil: number;
    renderToolbarTimeout: number;
    scrollSelectionIntoViewTimeout: number;
    showUtil: boolean;
    preventRender: boolean;
    gestureStartX: number;
    gestureStartY: number;
    gestureMoved: boolean;
}
