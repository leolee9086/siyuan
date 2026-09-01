/** 移动宿主注册的文件打开能力；宿主实例在注册闭包中绑定。 */
export interface IMobileFileOpenPort {
    open: (id: string, action?: TProtyleAction[], scrollPosition?: ScrollLogicalPosition, notebookId?: string) => void;
    openInNewTab?: (id: string, action?: TProtyleAction[], scrollPosition?: ScrollLogicalPosition, notebookId?: string) => void;
}
