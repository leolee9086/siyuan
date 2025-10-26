export const repoApiDefs = [
  {
    method: "POST",
    endpoint: "/api/repo/checkoutRepo",
    en: "checkoutRepo",
    zh_cn: "检出仓库快照",
    description: "将当前工作区内容回滚到指定的仓库快照版本。这是一个危险操作，会导致当前未保存的更改丢失，请谨慎操作。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要检出的快照的唯一标识符 (ID)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/createSnapshot",
    en: "createSnapshot",
    zh_cn: "创建快照",
    description: "为当前工作区创建一个新的快照。可以附带备注信息和标签。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      memo: z.string().optional().describe("可选。快照的备注信息。"),
      tag: z.string().optional().describe("可选。为快照打上的标签名。如果提供，则此快照同时会成为一个标签快照。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        id: z.string().describe("新创建的快照的唯一标识符 (ID)。")
      }).describe("包含新快照ID的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/diffRepoSnapshots",
    en: "diffRepoSnapshots",
    zh_cn: "比较快照差异",
    description: "比较两个指定的本地快照之间的差异，列出新增、修改和删除的文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      left: z.string().describe("必需。左侧快照的 ID，作为比较基准的旧版本。"),
      right: z.string().describe("必需。右侧快照的 ID，作为比较目标的新版本。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        addsLeft: z.array(z.object({ id: z.string().describe("文档ID"), hPath: z.string().describe("文档HPath") })).describe("右侧快照相对于左侧快照新增的文档列表。"),
        updatesLeft: z.array(z.object({ id: z.string().describe("文档ID"), hPath: z.string().describe("文档HPath") })).describe("在左侧快照中存在，并在右侧快照中被修改的文档列表。"),
        updatesRight: z.array(z.object({ id: z.string().describe("文档ID"), hPath: z.string().describe("文档HPath") })).describe("在右侧快照中存在，并在左侧快照中被修改的文档列表 (通常为空或与updatesLeft对称，具体含义需结合上下文)。"),
        removesRight: z.array(z.object({ id: z.string().describe("文档ID"), hPath: z.string().describe("文档HPath") })).describe("左侧快照中存在，但在右侧快照中被删除的文档列表。"),
        left: z.object({ id: z.string().describe("快照ID"), created: z.string().describe("创建时间戳 (Unix 毫秒)"), memo: z.string().describe("备注") }).describe("左侧快照的元信息。"),
        right: z.object({ id: z.string().describe("快照ID"), created: z.string().describe("创建时间戳 (Unix 毫秒)"), memo: z.string().describe("备注") }).describe("右侧快照的元信息。")
      }).describe("包含两个快照差异详情的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/downloadCloudSnapshot",
    en: "downloadCloudSnapshot",
    zh_cn: "下载云端快照",
    description: "从云端下载指定的快照到本地。如果本地已存在同名快照，可能会被覆盖或操作失败。下载的是标签快照时需要提供标签名。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要下载的云端快照的 ID。"),
      tag: z.string().optional().describe("可选。如果下载的是标签快照，则此为标签名。如果下载的是普通快照，此字段应为空字符串或省略。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/getCloudRepoSnapshots",
    en: "getCloudRepoSnapshots",
    zh_cn: "获取云端快照列表",
    description: "分页获取当前用户在云端存储的所有普通快照列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      page: z.number().int().positive().describe("必需。页码，从 1 开始。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        snapshots: z.array(z.object({
          id: z.string().describe("快照的唯一标识符 (ID)"),
          created: z.string().describe("快照创建时间 (Unix 时间戳字符串，秒级)"),
          hCreated: z.string().describe("快照创建时间 (格式化字符串)"),
          size: z.number().int().describe("快照大小 (字节)"),
          hSize: z.string().describe("快照大小 (格式化字符串)"),
          memo: z.string().describe("快照备注信息")
        })).describe("云端快照对象数组。"),
        pageCount: z.number().int().describe("总页数。"),
        totalCount: z.number().int().describe("快照总数量。")
      }).describe("包含云端快照列表、总页数和总数量的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/getCloudRepoTagSnapshots",
    en: "getCloudRepoTagSnapshots",
    zh_cn: "获取云端标签快照列表",
    description: "分页获取当前用户在云端存储的所有标签快照列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      page: z.number().int().positive().describe("必需。页码，从 1 开始。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        snapshots: z.array(z.object({
          id: z.string().describe("快照的唯一标识符 (ID)"),
          tag: z.string().describe("快照标签名。"),
          created: z.string().describe("快照创建时间 (Unix 时间戳字符串，秒级)"),
          hCreated: z.string().describe("快照创建时间 (格式化字符串)"),
          size: z.number().int().describe("快照大小 (字节)"),
          hSize: z.string().describe("快照大小 (格式化字符串)"),
          memo: z.string().describe("快照备注信息")
        })).describe("云端标签快照对象数组。"),
        pageCount: z.number().int().describe("总页数。"),
        totalCount: z.number().int().describe("标签快照总数量。")
      }).describe("包含云端标签快照列表、总页数和总数量的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/getRepoFile",
    en: "getRepoFile",
    zh_cn: "获取快照中的文件内容",
    description: "获取指定快照中特定文件的原始内容。此接口直接返回文件数据流，不返回标准JSON结构。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。快照的 ID。"),
      path: z.string().optional().describe("可选。快照内文件的相对路径。如果 id 已经是快照内文件的完整标识（如 `快照ID/文件路径.sy`），则此项可省略。")
    }),
    zodResponseSchema: (z) => z.any().describe("此接口不返回标准 JSON。成功时直接返回文件数据流 (HTTP 200)，Content-Type 根据文件类型确定。失败时返回标准 JSON 错误结构。")
  },
  {
    method: "POST",
    endpoint: "/api/repo/getRepoSnapshots",
    en: "getRepoSnapshots",
    zh_cn: "获取本地快照列表",
    description: "分页获取当前工作区本地存储的所有普通快照列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      page: z.number().int().positive().describe("必需。页码，从 1 开始。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        snapshots: z.array(z.object({
          id: z.string().describe("快照的唯一标识符 (ID)"),
          created: z.string().describe("快照创建时间 (Unix 时间戳字符串，秒级)"),
          hCreated: z.string().describe("快照创建时间 (格式化字符串)"),
          size: z.number().int().describe("快照大小 (字节)"),
          hSize: z.string().describe("快照大小 (格式化字符串)"),
          memo: z.string().describe("快照备注信息")
        })).describe("本地快照对象数组。"),
        pageCount: z.number().int().describe("总页数。"),
        totalCount: z.number().int().describe("快照总数量。")
      }).describe("包含本地快照列表、总页数和总数量的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/getRepoTagSnapshots",
    en: "getRepoTagSnapshots",
    zh_cn: "获取本地标签快照列表",
    description: "分页获取当前工作区本地存储的所有标签快照列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      page: z.number().int().positive().describe("必需。页码，从 1 开始。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        snapshots: z.array(z.object({
          id: z.string().describe("快照的唯一标识符 (ID)"),
          tag: z.string().describe("快照标签名。"),
          created: z.string().describe("快照创建时间 (Unix 时间戳字符串，秒级)"),
          hCreated: z.string().describe("快照创建时间 (格式化字符串)"),
          size: z.number().int().describe("快照大小 (字节)"),
          hSize: z.string().describe("快照大小 (格式化字符串)"),
          memo: z.string().describe("快照备注信息")
        })).describe("本地标签快照对象数组。"),
        pageCount: z.number().int().describe("总页数。"),
        totalCount: z.number().int().describe("标签快照总数量。")
      }).describe("包含本地标签快照列表、总页数和总数量的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/importRepoKey",
    en: "importRepoKey",
    zh_cn: "导入仓库密钥",
    description: "导入仓库加密密钥。这是一个危险操作，错误的密钥可能导致数据无法解密。导入的密钥文件通常是 .sykey 后缀。此操作通过 FormData 接收文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/initRepoKey",
    en: "initRepoKey",
    zh_cn: "初始化仓库密钥",
    description: "为当前工作区初始化一个新的随机加密密钥。此操作通常在首次设置加密或重置密钥时使用。旧密钥将被覆盖。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/initRepoKeyFromPassphrase",
    en: "initRepoKeyFromPassphrase",
    zh_cn: "通过口令初始化仓库密钥",
    description: "通过用户提供的口令生成并初始化仓库加密密钥。旧密钥将被覆盖。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      passphrase: z.string().min(1, "口令不能为空").describe("必需。用于生成密钥的用户口令。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/openRepoSnapshotDoc",
    en: "openRepoSnapshotDoc",
    zh_cn: "打开快照中的文档",
    description: "获取并打开指定快照中特定文档的内容，用于预览历史版本。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。快照中文档的唯一标识符 (通常是 `快照ID/文档ID.sy`)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        title: z.string().describe("文档的标题。"),
        content: z.string().describe("文档的内容 (HTML格式)。"),
        displayInText: z.boolean().describe("是否应在纯文本模式下显示 (通常为 false)。"),
        updated: z.string().describe("文档的最后更新时间 (Unix 时间戳字符串，秒级)。")
      }).nullable().describe("包含文档标题、内容和元信息的对象。失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/purgeCloudRepo",
    en: "purgeCloudRepo",
    zh_cn: "清理云端仓库",
    description: "彻底删除用户在云端的所有仓库数据，包括所有快照和标签快照。这是一个非常危险且不可逆的操作，执行前通常会有二次确认。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/purgeRepo",
    en: "purgeRepo",
    zh_cn: "清理本地仓库",
    description: "彻底删除当前工作区的本地仓库数据，包括所有快照和标签快照。这是一个非常危险且不可逆的操作，执行前通常会有二次确认。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/removeCloudRepoTagSnapshot",
    en: "removeCloudRepoTagSnapshot",
    zh_cn: "移除云端标签快照",
    description: "从云端移除指定的标签快照。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要移除的云端标签快照的 ID。"),
      tag: z.string().describe("必需。要移除的云端标签快照的标签名。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/removeRepoTagSnapshot",
    en: "removeRepoTagSnapshot",
    zh_cn: "移除本地标签快照",
    description: "从本地仓库移除指定的标签快照。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要移除的本地标签快照的 ID。"),
      tag: z.string().describe("必需。要移除的本地标签快照的标签名。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/resetRepo",
    en: "resetRepo",
    zh_cn: "重置本地仓库",
    description: "重置本地仓库，会清空所有快照和标签，并重新初始化仓库密钥。这是一个危险操作，执行前通常会有二次确认。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/setRepoIndexRetentionDays",
    en: "setRepoIndexRetentionDays",
    zh_cn: "设置快照索引保留天数",
    description: "设置本地仓库快照索引的保留天数。过期的索引将被自动清理。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      days: z.number().int().min(1, "保留天数至少为1天").describe("必需。快照索引保留的天数，必须为正整数。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/setRetentionIndexesDaily",
    en: "setRetentionIndexesDaily",
    zh_cn: "设置每日快照保留数量",
    description: "设置每日自动创建的快照在本地的保留数量。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      indexes: z.number().int().min(1, "保留数量至少为1").describe("必需。每日快照的保留数量，必须为正整数。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/tagSnapshot",
    en: "tagSnapshot",
    zh_cn: "标记快照",
    description: "为指定的本地快照打上标签，使其成为一个标签快照。可以同时提供备注，如果提供会覆盖快照原有的备注。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要标记的快照的 ID。"),
      tag: z.string().min(1, "标签名不能为空").describe("必需。要打上的标签名。"),
      memo: z.string().optional().describe("可选。快照的备注信息，如果提供，会覆盖快照原有的备注。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/repo/uploadCloudSnapshot",
    en: "uploadCloudSnapshot",
    zh_cn: "上传快照到云端",
    description: "将指定的本地快照上传到云端。如果是标签快照，需要提供标签名。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要上传的本地快照的 ID。"),
      tag: z.string().optional().describe("可选。如果上传的是标签快照，则此为标签名。如果上传的是普通快照，此字段应为空字符串或省略。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  }
];
