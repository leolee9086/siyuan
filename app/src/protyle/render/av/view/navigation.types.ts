/** View click 分支交给 Panel 导航所有者执行的完整结果。 */
export type ViewClickOutcome =
    | {kind: "unhandled"}
    | {kind: "handled"}
    | {kind: "open-view-menu"; blockElement: HTMLElement; element: HTMLElement};
