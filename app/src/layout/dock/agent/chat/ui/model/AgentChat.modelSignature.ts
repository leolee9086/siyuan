

/** 生成可用模型配置签名，供配置变化检测与选项刷新同步使用。 */
/**
 * `getUsableModelSignature` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
export const getUsableModelSignature = (aiConfig: Config.IAI): string => {
    const signatures: string[] = [];
    for (const provider of aiConfig.providers || []) {
        // Keyless provider 只依赖 enabled 与模型配置，不能以 apiKey 是否存在作为可用性条件。
        if (!provider.enabled) {
            continue;
        }
        const providerLabel = provider.displayName || provider.baseURL;
        for (const model of provider.models) {
            // 禁用或缺少可见名称的模型不进入选项签名。
            if (!model.enabled || (!model.displayName && !model.name)) {
                continue;
            }
            signatures.push(
                `${provider.id}:${model.id || model.name}:${providerLabel}:${model.displayName || ""}`,
            );
        }
    }
    return signatures.join("|");
};
