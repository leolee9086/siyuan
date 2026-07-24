/** 可写入独立窗口 URL hash 的模型身份。 */
export type WindowHashIdentity =
    | {readonly kind: "document-root"; readonly value: string}
    | {readonly kind: "asset-path"; readonly value: string};

/**
 * 窗口恢复所需的完整模型能力。
 *
 * 模型通过 getter 暴露当前身份，使文档根或资源路径更新后仍能生成最新 hash。
 */
export interface IWindowHashModel {
    readonly windowHashIdentity: WindowHashIdentity;
}
