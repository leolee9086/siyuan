export type editorContext = {
    //原始事件
    event: KeyboardEvent&{target:HTMLElement},
    //protyle
    protyle: IProtyle,
    //块元素
    nodeElement: HTMLElement,
    //选区
    range: Range,
    //用于控制流
    controller: AbortController
}