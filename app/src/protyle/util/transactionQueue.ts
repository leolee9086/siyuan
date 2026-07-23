const transactionQueues = new WeakMap<object, Promise<void>>();

export const queueTransaction = (protyle: object, task: () => Promise<void>) => {
    const previousTransaction = transactionQueues.get(protyle) || Promise.resolve();
    const currentTransaction = previousTransaction.catch(() => undefined).then(task);
    transactionQueues.set(protyle, currentTransaction);
    return currentTransaction;
};

export const waitForPendingTransactions = (protyle: object) => {
    return (transactionQueues.get(protyle) || Promise.resolve()).catch(() => undefined);
};
