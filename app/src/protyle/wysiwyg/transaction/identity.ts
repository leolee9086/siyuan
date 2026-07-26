/**
 * 验证事务操作必需的字符串身份并返回收窄结果。
 * @同步豁免: 类型守卫 - 事务对象构造前必须同步验证 DOM 和 Protyle 身份
 */
export const requireTransactionIdentity = (value: string | null | undefined, label: string) => {
    if (!value) {
        throw new Error(`Transaction requires ${label}`);
    }
    return value;
};
