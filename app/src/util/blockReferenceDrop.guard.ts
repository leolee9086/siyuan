/** 跨组件块引用拖放载荷的最小受信结构。 */
export type TBlockReferenceDropData = {
    ids: string[];
    workspaceDir: string;
};

/** 校验跨组件块引用拖放数据的结构，不信任反序列化后的字段类型。 */
/** @同步豁免: 类型守卫 */
/** @显式返回类型原因: 类型谓词是消费方缩窄 unknown 拖放载荷所需的公共契约。 */
export const isBlockReferenceDropData = (value: unknown): value is TBlockReferenceDropData => {
    if (typeof value !== "object" || value === null || !("ids" in value) || !("workspaceDir" in value)) {
        return false;
    }
    return Array.isArray(value.ids) && value.ids.every(id => typeof id === "string") &&
        typeof value.workspaceDir === "string";
};

/** 解析、校验并去重当前工作空间内的块引用拖放 ID；畸形载荷直接抛出错误。 */
/** @同步豁免: 类型守卫 */
export const parseBlockReferenceDropData = (payload: string, workspaceDir: string) => {
    const data: unknown = JSON.parse(payload);
    if (!isBlockReferenceDropData(data)) {
        throw new TypeError("Invalid block reference drop payload");
    }
    if (data.workspaceDir.toLowerCase() !== workspaceDir.toLowerCase()) {
        return [];
    }
    return Array.from(new Set(data.ids.filter(id => /^\d{14}-[0-9a-z]{7}$/.test(id))));
};
