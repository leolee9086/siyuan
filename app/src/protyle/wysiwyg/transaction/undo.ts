/** 同步登记事务撤销数据并更新编辑状态。 @同步豁免: 生命周期 - undo 必须先于本地同步和内核提交登记。 */
export const registerTransactionUndo = (protyle: IProtyle, doOperations: IOperation[], undoOperations?: IOperation[]) => {
    if (!undoOperations) {
        return;
    }
    const config = window.siyuan.config;
    if (!config) {
        throw new Error("Transaction undo registration requires initialized config");
    }
    const undo = protyle.undo;
    if (!undo) {
        throw new Error("Transaction undo registration requires undo manager");
    }
    // 当前标签复用模式下，首次本地更新后立即清除未更新标记。
    if (config.fileTree.openFilesUseCurrentTab && protyle.model) {
        protyle.model.headElement.classList.remove("item--unupdate");
    }
    protyle.updated = true;
    undo.add(doOperations, undoOperations, protyle);
};
