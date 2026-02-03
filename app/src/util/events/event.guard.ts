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

/**
 * 带有事件路径的鼠标事件类型
 *
 * 作用：表示可能包含 path 属性的 MouseEvent
 * 意图：某些浏览器（如旧版 Chrome）在事件冒泡时会提供 path 属性，
 *       用于获取事件传播路径上的所有元素
 */
export type MouseEventWithPath = MouseEvent & { path?: HTMLElement[] };

/**
 * 带有 HTMLElement target 的鼠标事件类型
 *
 * 作用：表示 target 已确认为 HTMLElement 的 MouseEvent
 * 意图：用于需要访问 event.target 作为 HTMLElement 的场景
 */
export type MouseEventWithHTMLTarget = MouseEvent & { target: HTMLElement };

/**
 * 鼠标事件类型守卫
 *
 * 作用：判断事件是否为鼠标事件，并进行类型收窄
 * 意图：在事件处理中安全地访问 MouseEvent 特有的属性
 * 调用时机：在需要处理鼠标相关逻辑前，先用此函数确认事件类型
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果，否则无法进行编译时类型收窄
 */
export const isMouseEvent = (event: Event): event is MouseEvent => {
    return event instanceof MouseEvent;
};

/**
 * 带有路径的鼠标事件类型守卫
 *
 * 作用：判断事件是否为鼠标事件（可能带有 path 属性），并进行类型收窄
 * 意图：用于处理需要访问事件路径的场景，如 popover 的隐藏逻辑
 * 调用时机：在需要访问 event.path 或其他 MouseEvent 属性前调用
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果，否则无法进行编译时类型收窄
 */
export const isMouseEventWithPath = (event: Event): event is MouseEventWithPath => {
    return event instanceof MouseEvent;
};

/**
 * 带有 HTMLElement target 的鼠标事件类型守卫
 *
 * 作用：判断鼠标事件的 target 是否为 HTMLElement，并进行类型收窄
 * 意图：用于需要安全访问 event.target 作为 HTMLElement 的场景
 * 调用时机：在需要访问 event.target 的 HTMLElement 属性前调用
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果，否则无法进行编译时类型收窄
 */
export const isMouseEventWithHTMLTarget = (event: MouseEvent): event is MouseEventWithHTMLTarget => {
    return event.target instanceof HTMLElement;
};

/**
 * 将 MouseEvent 安全转换为 MouseEventWithPath
 *
 * 作用：将普通 MouseEvent 转换为带有可选 path 属性的类型
 * 意图：MouseEvent 本身就兼容 MouseEventWithPath 类型（path 是可选的），
 *       此函数提供类型安全的转换方式
 * @同步豁免: 类型守卫 - 此函数用于类型转换，必须同步返回
 */
export const asMouseEventWithPath = (event: MouseEvent): MouseEventWithPath => {
    return event;
};