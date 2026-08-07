/** 将未知异常收窄为属性 Dock 可展示的消息。 */
export function filePropertiesErrorText(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
