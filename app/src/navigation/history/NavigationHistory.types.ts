/** 用途：区分共享注册表中的桌面与移动导航历史；使用场景：所有前进/后退状态读写；关联类型：NavigationHistoryState。 */
export type NavigationHistoryScope = "desktop" | "mobile";

/** 用途：完整描述单个宿主的前进历史与方向状态；使用场景：导航注册表值；关联类型：NavigationHistoryScope。 */
export interface NavigationHistoryState {
    forwardStack: IBackStack[];
    previousIsBack: boolean;
}
