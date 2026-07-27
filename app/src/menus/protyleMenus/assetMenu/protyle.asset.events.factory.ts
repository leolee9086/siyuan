/**
 * 构造资源菜单上一项/下一项按钮复用键盘导航所需的原生事件。
 * @同步豁免: UI构建 - 合成事件必须在按钮 click 调用栈内同步分发，保持既有导航和预览顺序。
 */
export const createAssetMenuArrowKeyEvent = (key: "ArrowUp" | "ArrowDown") => new KeyboardEvent("keydown", {key});
