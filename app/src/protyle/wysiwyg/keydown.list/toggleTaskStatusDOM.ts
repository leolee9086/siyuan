/**
 * 用途：引入任务状态联合类型，约束当前 DOM 写入辅助函数只接收已经在状态收集阶段确定好的目标任务状态。
 * 使用范围：仅用于当前文件的 [`setTaskStatusDOM()`](app/src/protyle/wysiwyg/keydown.list/toggleTaskStatusDOM.ts:15) 参数类型标注；边界是不把 unified 状态结构整体耦合进来，也不在此文件内重新定义状态空间。
 * 解耦评估：理论上可在函数签名中直接内联 `"todo" | "done"` 字面量联合类型，但那会把同一任务状态契约散落到状态提取层和 DOM 落地层，后续扩展状态值时容易失配。通过同目录 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts:1) 复用共享类型，可以在不引入运行时依赖的前提下保持契约同源；依赖注入或事件发射都不适用于这种纯编译期约束。
 */
import type { TaskStatus } from "./types";

/**
 * 应用任务状态对应的 DOM 操作
 *
 * @param taskItemElement - 任务列表项元素
 * @param useElement - use 元素（用于显示图标）
 * @param status - 目标任务状态
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要在键盘事件处理的同一帧内立即修改任务项 DOM。
 * 2. 图标、类名和 data-task 属性必须保持同步更新，避免中间态被事务或日志读取到。
 * 3. 这里是纯 DOM 落地辅助函数，不涉及可等待的异步副作用。
 */
export const setTaskStatusDOM = (
    taskItemElement: HTMLElement,
    useElement: SVGUseElement,
    status: TaskStatus
) => {
    const isDone = status === "done";

    useElement.setAttribute("xlink:href", isDone ? "#iconCheck" : "#iconUncheck");
    taskItemElement.classList.toggle("protyle-task--done", isDone);
    taskItemElement.setAttribute("data-task", isDone ? "X" : " ");
};
