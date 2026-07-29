/** 检查静态语言资源是否为可安装到 Siyuan 运行时的字典对象。 */
export const isSiyuanLanguages = (value: unknown): value is NonNullable<ISiyuan["languages"]> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
