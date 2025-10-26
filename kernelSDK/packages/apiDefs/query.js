export const queryApiDefs = [
  {
    method: "POST",
    endpoint: "/api/query/sql",
    en: "SQL",
    zh_cn: "执行SQL查询",
    description: "执行 SQL 查询语句，返回查询结果。思源笔记使用 SQLite 作为底层数据库，支持标准的 SQL 查询语法。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      stmt: z.string().describe("必需。要执行的 SQL 查询语句。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，其他值表示失败。"),
      Msg: z.string().describe("错误信息，成功时通常为空字符串。"),
      Data: z.array(z.record(z.any())).nullable().describe("查询结果数组。每个元素是一个对象，键为列名，值为该列的值。查询失败或无结果时可能为 null 或空数组。")
    })
  }
];
