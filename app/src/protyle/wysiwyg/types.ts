/**
 * 编辑器上下文对象类型定义
 *
 * ### 用途
 * 该类型封装了编辑器在处理特定交互（如键盘事件）时所需的核心上下文信息，
 * 旨在通过单一对象传递多个相关状态，减少函数参数数量并提高代码可读性。
 *
 * ### 使用场景
 * 主要用于 `wysiwyg/keydown.ts` 及其拆分的子模块（如 `keydown.enter.ts`, `keydown.table.ts` 等）中。
 * 在按键按下时，由主分发器构造此对象并传递给具体的处理函数。
 *
 * ### 关联类型
 * - `IProtyle`: SiYuan 编辑器核心实例。
 * - `KeyboardEvent`: 触发事件的原始 DOM 键盘事件。
 * - `HTMLElement`: 关联的块级元素或其他 DOM 节点。
 *
 * ### 问题/改进
 * - 目前 `event` 的 target 类型断言为 `HTMLElement` 可能在极少数非标准事件中存在风险。
 * - 考虑将来将 `Range` 封装为更稳定的内部选区对象以适配更复杂的编辑场景。
 */
export type editorContext = {
    /** 触发操作的原始键盘事件，target 已通过类型交集强化为 HTMLElement */
    event: KeyboardEvent & { target: HTMLElement },
    /** 当前编辑器的主实例 */
    protyle: IProtyle,
    /** 当前操作直接关联的块元素或 DOM 节点 */
    nodeElement: HTMLElement,
    /** 触发时的 DOM 选区范围 */
    range: Range,
    /** 用于控制逻辑流（如中止后续分发）的信号控制器 */
    controller: AbortController
}
