export const setSiyuanCtrlIsPressed = (isPressed: boolean): void => {
    window.siyuan.ctrlIsPressed = isPressed;
};

export const setSiyuanShiftIsPressed = (isPressed: boolean): void => {
    window.siyuan.shiftIsPressed = isPressed;
};

export const setSiyuanAltIsPressed = (isPressed: boolean): void => {
    window.siyuan.altIsPressed = isPressed;
};

export const getSiyuanCtrlIsPressed = (): boolean => {
    return window.siyuan.ctrlIsPressed;
};
