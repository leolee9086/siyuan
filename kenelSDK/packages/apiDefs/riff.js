export const riffApiDefs = [
  {
    method: "POST",
    endpoint: "/api/riff/addRiffCards",
    en: "addRiffCards",
    zh_cn: "添加闪卡",
    description: "将指定的块添加为闪卡到指定的闪卡包中。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      deckID: z.string().describe("必需。目标闪卡包的 ID。"),
      blockIDs: z.array(z.string()).describe("必需。要添加为闪卡的块 ID 数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        id: z.string().describe("闪卡包 ID"),
        name: z.string().describe("闪卡包名称"),
        size: z.number().describe("闪卡包中的卡片数量"),
        created: z.string().describe("闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss"),
        updated: z.string().describe("闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss")
      }).nullable().describe("成功时返回更新后的闪卡包信息，如果 deckID 为空字符串（表示操作 All 卡包），则为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/batchSetRiffCardsDueTime",
    en: "batchSetRiffCardsDueTime",
    zh_cn: "批量设置闪卡到期时间",
    description: "批量设置闪卡的到期时间。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      cardDues: z.array(z.object({
        id: z.string().describe("必需。闪卡块 ID。"),
        due: z.string().describe("必需。新的到期时间，ISO 8601 格式的日期时间字符串。")
      })).describe("必需。包含闪卡 ID 和对应新到期时间的数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/createRiffDeck",
    en: "createRiffDeck",
    zh_cn: "创建闪卡包",
    description: "创建一个新的闪卡包。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      name: z.string().describe("必需。新闪卡包的名称。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        id: z.string().describe("新创建的闪卡包 ID"),
        name: z.string().describe("新创建的闪卡包名称"),
        size: z.number().describe("新创建的闪卡包中的卡片数量 (初始为0)"),
        created: z.string().describe("闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss"),
        updated: z.string().describe("闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss")
      }).describe("成功时返回新创建的闪卡包信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getNotebookRiffCards",
    en: "getNotebookRiffCards",
    zh_cn: "获取笔记本下的所有闪卡",
    description: "获取指定笔记本下的所有闪卡块 ID，支持分页。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。笔记本 ID。"),
      page: z.number().int().min(1).describe("必需。页码，从 1 开始。"),
      pageSize: z.number().int().min(1).optional().describe("可选。每页数量，默认为 20。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.string()).describe("当前页的闪卡块 ID 数组。"),
        total: z.number().int().describe("该笔记本下闪卡总数。"),
        pageCount: z.number().int().describe("总页数。")
      }).describe("成功时返回分页的闪卡块 ID 及分页信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getNotebookRiffDueCards",
    en: "getNotebookRiffDueCards",
    zh_cn: "获取笔记本下的到期闪卡",
    description: "获取指定笔记本下所有到期应复习的闪卡。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("必需。笔记本 ID。"),
      reviewedCards: z.array(z.object({
        cardID: z.string().describe("已复习卡片的 ID")
      })).optional().describe("可选。当前学习会话中已经复习过的卡片列表，用于在获取下一张卡片时排除它们。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        cards: z.array(z.object({
          id: z.string().describe("闪卡块 ID"),
          deckID: z.string().describe("所属闪卡包 ID"),
          blockID: z.string().describe("原始块 ID"),
          created: z.string().describe("创建时间戳 (毫秒)"),
          due: z.string().describe("到期时间戳 (毫秒)"),
          interval: z.number().describe("复习间隔 (天)"),
          easeFactor: z.number().describe("易度因子"),
          reps: z.number().int().describe("已复习次数")
        })).describe("到期闪卡列表。"),
        unreviewedCount: z.number().int().describe("未复习卡片总数。"),
        unreviewedNewCardCount: z.number().int().describe("未复习新卡片数量。"),
        unreviewedOldCardCount: z.number().int().describe("未复习旧卡片数量。")
      }).describe("成功时返回到期闪卡列表及统计信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getRiffCards",
    en: "getRiffCards",
    zh_cn: "获取闪卡包中的所有闪卡",
    description: "获取指定闪卡包中的所有闪卡块 ID，支持分页。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。闪卡包 ID。"),
      page: z.number().int().min(1).describe("必需。页码，从 1 开始。"),
      pageSize: z.number().int().min(1).optional().describe("可选。每页数量，默认为 20。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.object({
          id: z.string().describe("闪卡块 ID"),
          deckID: z.string().describe("所属闪卡包 ID"),
          blockID: z.string().describe("原始块 ID"),
          created: z.string().describe("创建时间戳 (毫秒)"),
          due: z.string().describe("到期时间戳 (毫秒)"),
          interval: z.number().describe("复习间隔 (天)"),
          easeFactor: z.number().describe("易度因子"),
          reps: z.number().int().describe("已复习次数")
        })).describe("当前页的闪卡对象数组。"),
        total: z.number().int().describe("该闪卡包下闪卡总数。"),
        pageCount: z.number().int().describe("总页数。")
      }).describe("成功时返回分页的闪卡对象及分页信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getRiffCardsByBlockIDs",
    en: "getRiffCardsByBlockIDs",
    zh_cn: "根据块ID批量获取闪卡信息",
    description: "根据一组块 ID 批量获取它们对应的闪卡信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      blockIDs: z.array(z.string()).describe("必需。块 ID 数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.object({
          id: z.string().describe("闪卡块 ID"),
          deckID: z.string().describe("所属闪卡包 ID"),
          blockID: z.string().describe("原始块 ID"),
          created: z.string().describe("创建时间戳 (毫秒)"),
          due: z.string().describe("到期时间戳 (毫秒)"),
          interval: z.number().describe("复习间隔 (天)"),
          easeFactor: z.number().describe("易度因子"),
          reps: z.number().int().describe("已复习次数")
        })).describe("对应的闪卡信息数组。如果某个 blockID 不是闪卡，则对应项可能缺失或为 null。")
      }).describe("成功时返回闪卡信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getRiffDecks",
    en: "getRiffDecks",
    zh_cn: "获取所有闪卡包",
    description: "获取当前工作空间中所有的闪卡包列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.array(z.object({
        id: z.string().describe("闪卡包 ID"),
        name: z.string().describe("闪卡包名称"),
        size: z.number().int().describe("闪卡包中的卡片数量"),
        created: z.string().describe("闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss"),
        updated: z.string().describe("闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss")
      })).describe("成功时返回所有闪卡包的信息数组。如果没有闪卡包，则返回空数组。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getRiffDueCards",
    en: "getRiffDueCards",
    zh_cn: "获取闪卡包中的到期闪卡",
    description: "获取指定闪卡包中所有到期应复习的闪卡。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      deckID: z.string().describe("必需。闪卡包 ID。"),
      reviewedCards: z.array(z.object({
        cardID: z.string().describe("已复习卡片的 ID")
      })).optional().describe("可选。当前学习会话中已经复习过的卡片列表，用于在获取下一张卡片时排除它们。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        cards: z.array(z.object({
          id: z.string().describe("闪卡块 ID"),
          deckID: z.string().describe("所属闪卡包 ID"),
          blockID: z.string().describe("原始块 ID"),
          created: z.string().describe("创建时间戳 (毫秒)"),
          due: z.string().describe("到期时间戳 (毫秒)"),
          interval: z.number().describe("复习间隔 (天)"),
          easeFactor: z.number().describe("易度因子"),
          reps: z.number().int().describe("已复习次数")
        })).describe("到期闪卡列表。"),
        unreviewedCount: z.number().int().describe("未复习卡片总数。"),
        unreviewedNewCardCount: z.number().int().describe("未复习新卡片数量。"),
        unreviewedOldCardCount: z.number().int().describe("未复习旧卡片数量。")
      }).describe("成功时返回到期闪卡列表及统计信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getTreeRiffCards",
    en: "getTreeRiffCards",
    zh_cn: "获取文档树下的所有闪卡",
    description: "获取指定文档树（根块）下的所有闪卡块 ID，支持分页。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。文档树的根块 ID。"),
      page: z.number().int().min(1).describe("必需。页码，从 1 开始。"),
      pageSize: z.number().int().min(1).optional().describe("可选。每页数量，默认为 20。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.string()).describe("当前页的闪卡块 ID 数组。"),
        total: z.number().int().describe("该文档树下闪卡总数。"),
        pageCount: z.number().int().describe("总页数。")
      }).describe("成功时返回分页的闪卡块 ID 及分页信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/getTreeRiffDueCards",
    en: "getTreeRiffDueCards",
    zh_cn: "获取文档树下的到期闪卡",
    description: "获取指定文档树（根块）下所有到期应复习的闪卡。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      rootID: z.string().describe("必需。文档树的根块 ID。"),
      reviewedCards: z.array(z.object({
        cardID: z.string().describe("已复习卡片的 ID")
      })).optional().describe("可选。当前学习会话中已经复习过的卡片列表，用于在获取下一张卡片时排除它们。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        cards: z.array(z.object({
          id: z.string().describe("闪卡块 ID"),
          deckID: z.string().describe("所属闪卡包 ID"),
          blockID: z.string().describe("原始块 ID"),
          created: z.string().describe("创建时间戳 (毫秒)"),
          due: z.string().describe("到期时间戳 (毫秒)"),
          interval: z.number().describe("复习间隔 (天)"),
          easeFactor: z.number().describe("易度因子"),
          reps: z.number().int().describe("已复习次数")
        })).describe("到期闪卡列表。"),
        unreviewedCount: z.number().int().describe("未复习卡片总数。"),
        unreviewedNewCardCount: z.number().int().describe("未复习新卡片数量。"),
        unreviewedOldCardCount: z.number().int().describe("未复习旧卡片数量。")
      }).describe("成功时返回到期闪卡列表及统计信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/removeRiffCards",
    en: "removeRiffCards",
    zh_cn: "移除闪卡",
    description: "从指定的闪卡包中移除指定的闪卡。如果 deckID 为空字符串，则从所有闪卡包中移除。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      deckID: z.string().describe("必需。目标闪卡包的 ID。如果为空字符串，则表示从所有卡包中移除这些卡片（通常用于\"All\"卡包的操作场景，但后端实际是根据 blockID 移除）。"),
      blockIDs: z.array(z.string()).describe("必需。要移除的闪卡块 ID 数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        id: z.string().describe("闪卡包 ID"),
        name: z.string().describe("闪卡包名称"),
        size: z.number().describe("闪卡包中的卡片数量"),
        created: z.string().describe("闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss"),
        updated: z.string().describe("闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss")
      }).nullable().describe("成功时返回更新后的闪卡包信息。如果操作的是\"All\"卡包（即传入的 deckID 为空字符串），则 Data 为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/removeRiffDeck",
    en: "removeRiffDeck",
    zh_cn: "移除闪卡包",
    description: "移除指定的闪卡包及其包含的所有闪卡。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      deckID: z.string().describe("必需。要移除的闪卡包 ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/renameRiffDeck",
    en: "renameRiffDeck",
    zh_cn: "重命名闪卡包",
    description: "重命名指定的闪卡包。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      deckID: z.string().describe("必需。要重命名的闪卡包 ID。"),
      name: z.string().describe("必需。新的闪卡包名称。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/resetRiffCards",
    en: "resetRiffCards",
    zh_cn: "重置闪卡",
    description: "重置指定范围内的闪卡的学习进度。可以按笔记本、文档树或闪卡包进行重置，也可以指定具体的块 ID 列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      type: z.enum(["notebook", "tree", "deck"]).describe("必需。重置类型：'notebook' (笔记本), 'tree' (文档树), 'deck' (闪卡包)。"),
      id: z.string().describe("必需。对应类型的 ID：笔记本 ID、文档树根块 ID 或闪卡包 ID。"),
      deckID: z.string().describe("必需。闪卡包 ID。即使 type 是 'notebook' 或 'tree'，也需要指定一个 deckID 来确定操作范围，通常可以是这些卡片实际所属的卡包 ID，或者是全局的卡片操作。具体逻辑需参照后端 model.ResetFlashcards 实现。从 riff.go L89 看，此参数未被直接使用，但model层可能需要。暂时保留。"),
      blockIDs: z.array(z.string()).optional().describe("可选。要重置的具体闪卡块 ID 数组。如果未提供或为空数组，则重置 type 和 id 指定范围内的所有卡片。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/reviewRiffCard",
    en: "reviewRiffCard",
    zh_cn: "复习闪卡",
    description: "对指定的闪卡进行一次复习，并根据评分更新其下次到期时间等学习状态。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      deckID: z.string().describe("必需。闪卡所属的卡包 ID。"),
      cardID: z.string().describe("必需。要复习的闪卡块 ID。"),
      rating: z.number().int().min(0).max(4).describe("必需。评分，通常为 0 (Again), 1 (Hard), 2 (Good), 3 (Easy), 4 (Soon)。具体数值对应关系可能依赖于底层的 SM-2 算法实现。参照 riff.Rating 定义，0:Again, 1:Hard, 2:Good, 3:Easy, 4:Soon, (SM2 的0-5 对应这里的0-4?)"),
      reviewedCards: z.array(z.object({
        cardID: z.string().describe("已复习卡片的 ID")
      })).optional().describe("可选。当前学习会话中已经复习过的卡片列表，用于在获取下一张卡片时排除它们（后端逻辑 model.ReviewFlashcard 中使用了 reviewedCardIDs）。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/riff/skipReviewRiffCard",
    en: "skipReviewRiffCard",
    zh_cn: "跳过复习闪卡",
    description: "跳过当前闪卡的复习，通常是将其推迟到当前学习队列的末尾或稍后。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      deckID: z.string().describe("必需。闪卡所属的卡包 ID。"),
      cardID: z.string().describe("必需。要跳过复习的闪卡块 ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  }
];
