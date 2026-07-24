/** 读取布局模型显式提供的窗口恢复身份；非法结构不参与 hash 持久化。 @同步豁免: 类型守卫 */
export function readWindowHashIdentity(value: unknown) {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }
    const identity = Reflect.get(value, "windowHashIdentity");
    if (typeof identity !== "object" || identity === null) {
        return undefined;
    }
    const kind = Reflect.get(identity, "kind");
    const identityValue = Reflect.get(identity, "value");
    if (typeof identityValue !== "string") {
        return undefined;
    }
    if (kind === "document-root") {
        return {kind, value: identityValue} as const;
    }
    if (kind === "asset-path") {
        return {kind, value: identityValue} as const;
    }
    return undefined;
}
