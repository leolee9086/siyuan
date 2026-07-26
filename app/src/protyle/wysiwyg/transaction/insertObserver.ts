/**
 * 插入操作提交启动后断开旧的懒加载观察器，避免继续观察已改变的 DOM 区域。
 * @同步豁免: 生命周期 - 必须紧随本地事务启动执行，保持旧观察器生命周期顺序
 */
export const disconnectInsertObserver = (protyle: IProtyle, doOperations: IOperation[]) => {
    const insertOperation = doOperations.find(item => item.action === "insert");
    if (!insertOperation) {
        return;
    }
    protyle.observerLoad?.disconnect();
};
