/** 数据库行预览只读取持久化页签的实例类型和行身份，不把未校验 JSON 当作完整布局对象。 */
export const isDatabaseRowTabData = (value: object): value is {instance: "Editor"; databaseRowId: string} =>
    "instance" in value && value.instance === "Editor" &&
    "databaseRowId" in value && typeof value.databaseRowId === "string";
