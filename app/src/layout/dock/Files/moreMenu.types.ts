/**
 * 文件树"更多"菜单类型定义
 */

/**
 * 初始化更多菜单的依赖参数
 */
export interface InitMoreMenuDeps {
    /** 文件树元素，用于禁用状态检查 */
    element: HTMLElement;
    /** 初始化函数，用于刷新后重新初始化文件树 */
    init: (isInitialCall?: boolean) => void;
    /** 发布权限开关刷新函数 */
    refreshPublishAccessSwitch?: () => void;
    /** 按当前设置和发布权限编辑状态刷新文档动作区域 */
    updateDocActions?: () => void;
}
