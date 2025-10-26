export const outlineApiDefs = [
  {
    method: "POST",
    endpoint: "/api/outline/getDocOutline",
    en: "getDocOutline",
    zh_cn: "获取文档大纲",
    description: "获取指定文档块（通常是文档的根块ID）的层级大纲结构。",
    needAuth: true, // from router.go: model.CheckAuth
    needAdminRole: false, // from router.go
    unavailableIfReadonly: false, // from router.go
    zodRequestSchema: (z) =>({
      id: z.string().describe("必需。要获取大纲的文档块的 ID。通常是文档的根块 ID。"),
      preview: z.boolean().optional().default(false).describe("可选。是否为预览模式获取大纲，默认为 false。预览模式可能包含未保存的更改。")
    }),
    zodResponseSchema: (z) => {
      // 定义大纲条目的递归 schema
      const headingSchema = z.lazy(() => z.object({
        id: z.string().describe("标题块的唯一标识符 (ID)"),
        depth: z.number().int().describe("标题的层级深度，例如 H1 为 0，H2 为 1，以此类推。"),
        text: z.string().describe("标题块的文本内容。"),
        blockCount: z.number().int().describe("该标题下的内容块数量（不含标题自身和子标题）。"),
        children: z.array(headingSchema).optional().describe("该标题下的子标题数组，结构与父级相同。"),
        subType: z.string().describe("标题块的子类型，例如 'h1', 'h2', 'h3' 等。")
        // 注意: Go 源码中的 model.OutlineBlock 还有 ` ial` (interface{}) 和 `updated` (string) 字段，但通常不包含在 API 返回中，此处省略
      }));

      return ({
        Code: z.number().describe("返回码，0 表示成功"),
        Msg: z.string().describe("错误信息，成功时为空字符串"),
        Data: z.array(headingSchema).nullable().describe("文档的大纲结构数组。如果文档不存在或无标题，可能为 null 或空数组。")
      })
    }
  }
];
