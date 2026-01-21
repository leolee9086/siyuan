/**
 * 键盘事件类型守卫
 *
 * 作用：判断事件是否为键盘事件，并进行类型收窄
 * 意图：在事件处理中安全地访问 KeyboardEvent 特有的属性（如 key、code、isComposing 等）
 * 调用时机：在需要处理键盘相关逻辑前，先用此函数确认事件类型
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果，否则无法进行编译时类型收窄
 */
export const isKeybord = (event: Event): event is KeyboardEvent => {
    return event instanceof KeyboardEvent;
};

/**
 * 输入事件类型守卫
 *
 * 作用：判断事件是否为输入事件，并进行类型收窄
 * 意图：在事件处理中安全地访问 InputEvent 特有的属性（如 data、inputType、isComposing 等）
 * 调用时机：在需要处理文本输入相关逻辑前，先用此函数确认事件类型
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果，否则无法进行编译时类型收窄
 */
export const isInputEvent = (event: Event): event is InputEvent => {
    return event instanceof InputEvent;
};

/**
 * 输入法组合状态检测
 *
 * 作用：判断当前事件是否处于输入法组合（IME composition）状态
 * 意图：用于在用户使用中文、日文等需要输入法的语言时，避免在拼音/假名
 *       尚未转换为最终文字前误触发快捷键或其他键盘事件处理逻辑
 * 调用时机：在键盘事件处理器中，决定是否响应按键前调用此函数进行过滤
 *
 * @example
 * ```ts
 * document.addEventListener('keydown', (e) => {
 *     if (isComposing(e)) return; // 正在输入中文，跳过
 *     // 正常的快捷键处理...
 * });
 * ```
 * @同步豁免: 类型守卫 - 此函数依赖两个类型守卫的同步结果来安全访问 isComposing 属性
 */
export const isComposing = (event: Event) => {
    return (isKeybord(event) || isInputEvent(event)) && event.isComposing;
};