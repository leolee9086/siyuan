export const tagApiDefs = [
  {
    method: "POST",
    endpoint: "/api/tag/getTag",
    en: "getTag",
    zh_cn: "获取所有标签列表",
    description: "获取当前工作空间的所有标签列表。可以提供一个可选的排序参数来即时更新并应用全局标签排序设置。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      sort: z.number().int().optional().describe("可选的排序模式。0: 按标签引用计数降序, 1: 按标签字符升序, 2: 按标签字符降序, 3: 按最近使用升序, 4: 按最近使用降序, 5: 按创建时间升序, 6: 按创建时间降序。如果提供此参数，会更新并保存全局标签排序配置。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息，成功时为空字符串。"),
      data: z.array(z.object({
        label: z.string().describe("标签的名称。"),
        count: z.number().int().describe("标签关联的块数量（文档块+列表项块等）。"),
        blockCount: z.number().int().describe("标签关联的文档块数量。"),
        hCreated: z.string().describe("标签创建时间的人类可读格式。"),
        hUpdated: z.string().describe("标签最后更新时间的人类可读格式。")
      })).nullable().describe("成功时返回标签对象数组，失败时可能为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/tag/removeTag",
    en: "removeTag",
    zh_cn: "移除标签",
    description: "根据标签名称移除一个标签。这会从所有关联的块中移除该标签。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      label: z.string().describe("要移除的标签的名称。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功，-1 表示失败。"),
      msg: z.string().describe("错误信息。"),
      data: z.object({
        closeTimeout: z.number().optional().describe("操作失败时，前端弹窗的关闭延时（毫秒）。")
      }).nullable().describe("成功时为 null，失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/tag/renameTag",
    en: "renameTag",
    zh_cn: "重命名标签",
    description: "将一个旧标签名称重命名为一个新标签名称。所有关联块中的标签引用都会被更新。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      oldLabel: z.string().describe("要重命名的旧标签名称。"),
      newLabel: z.string().describe("新的标签名称。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功，-1 表示失败。"),
      msg: z.string().describe("错误信息。"),
      data: z.object({
        closeTimeout: z.number().optional().describe("操作失败时，前端弹窗的关闭延时（毫秒）。")
      }).nullable().describe("成功时为 null，失败时可能包含 closeTimeout。")
    })
  }
];
