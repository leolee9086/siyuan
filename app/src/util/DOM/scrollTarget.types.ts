/**
 * 用途：描述明确 DOM 目标相对滚动容器的完整纵向放置策略。
 * 使用场景：编辑器目标定位和 AV 定位共享同一滚动原语时传入。
 * 关联类型：沿用浏览器滚动类型，`start` 分支额外要求调用域提供布局间距。
 * 问题/改进：当前只覆盖既有纵向语义，横向滚动继续由具体视图负责。
 */
export type TargetScrollOptions =
    | {position: "start"; behavior: ScrollBehavior; topSpacing: number}
    | {position: "center" | "nearest"; behavior: ScrollBehavior};
