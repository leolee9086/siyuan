export const archiveApiDefs = [
  {
    method: "POST",
    endpoint: "/api/archive/unzip",
    en: "unzip",
    zh_cn: "解压文件",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    description: "将指定的 .zip 文件解压到指定路径。",
    zodRequestSchema: (z) => ({
      zipPath: z.string().describe("要解压的 .zip 文件的绝对路径或相对于工作空间的路径"),
      path: z.string().describe("解压到目标目录的绝对路径或相对于工作空间的路径")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("此接口通常不返回数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/archive/zip",
    en: "zip",
    zh_cn: "压缩文件/目录",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    description: "将指定路径的文件或目录压缩到指定的 .zip 文件。",
    zodRequestSchema: (z) => ({
      path: z.string().describe("要压缩的文件或目录的绝对路径或相对于工作空间的路径"),
      zipPath: z.string().describe("生成的 .zip 文件保存的绝对路径或相对于工作空间的路径")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("此接口通常不返回数据")
    })
  }
];
