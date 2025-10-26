export const transactionsApiDefs = [
  {
    method: "POST",
    endpoint: "/api/transactions",
    en: "performTransactions",
    zh_cn: "执行事务操作",
    description: "执行一个或多个事务操作，每个事务可以包含多个具体的数据修改动作。这是思源笔记中进行数据修改最核心的接口之一。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => {
      // Operation Schema for Request
      const operationSchemaReq = z.object({
        action: z.string().describe("必需，具体的操作名称 (如 updateBlock, insertBlock, deleteBlock, setBlockAttrs, foldHeading, addFlashcards, setAttrViewName, updateAttrViewCell 等)。实际可用 action 请参考 kernel/model/transaction.go 中的 performTx 函数内 switch case 定义。"),
        id: z.string().optional().describe("操作目标块的 ID (大多数操作需要)。"),
        parentID: z.string().optional().describe("父块 ID (例如 insertBlock, moveBlock 时需要)。"),
        previousID: z.string().optional().describe("前一个同级块 ID (例如 insertBlock, moveBlock 时需要，用于指定插入或移动的位置)。"),
        nextID: z.string().optional().describe("后一个同级块 ID (例如 insertBlock, moveBlock 时需要，用于指定插入或移动的位置)。"),
        data: z.any().optional().describe("操作的具体数据，结构随 action 不同而变化。例如，updateBlock 时为 Markdown 字符串，setBlockAttrs 时为属性名值对对象。具体结构请参考相应 action 在 model 层 (如 kernel/model/transaction.go 或 kernel/model/attribute_view.go) 的 do<ActionName> 或相关处理函数。"),
        dataType: z.string().optional().describe("数据类型，例如 \"markdown\", \"dom\"。通常在插入或更新块内容时使用。"),
        isDetached: z.boolean().optional().describe("是否为分离的操作。"),
        // 以下字段主要根据 kernel/model/transaction.go Operation 结构体补充
        box: z.string().optional().describe("块所属的笔记本 ID。"),
        path: z.string().optional().describe("块的存储路径。"),
        name: z.string().optional().describe("操作相关的名称，例如属性视图操作中的列名或视图名。"),
        keyID: z.string().optional().describe("属性视图操作中的列 Key ID。"),
        avID: z.string().optional().describe("属性视图 ID。"),
        blockIDs: z.array(z.string()).optional().describe("块 ID 数组，例如在闪卡操作 (addFlashcards, removeFlashcards) 中。"),
        deckID: z.string().optional().describe("闪卡包 ID。"),
        rowID: z.string().optional().describe("属性视图行 ID (通常是块 ID，用于 updateAttrViewCell 等操作)。"),
        srcID: z.string().optional().describe("源块 ID，例如在转换操作 (doc2Heading) 中。"),
        targetID: z.string().optional().describe("目标块 ID，例如在转换操作 (doc2Heading) 中。"),
        after: z.boolean().optional().describe("一个布尔值，用于某些操作中指定相对位置。"),
        srcHeadingID: z.string().optional().describe("源标题块 ID (heading2Doc 操作)。"),
        targetNoteBook: z.string().optional().describe("目标笔记本 ID (heading2Doc, li2Doc 操作)。"),
        targetPath: z.string().optional().describe("目标路径 (heading2Doc, li2Doc 操作)。"),
        previousPath: z.string().optional().describe("前一个路径 (heading2Doc, li2Doc 操作)。"),
        srcListItemID: z.string().optional().describe("源列表项 ID (li2Doc 操作)。"),
        fromPaths: z.array(z.string()).optional().describe("源路径数组 (moveDocs 操作)。"),
        toNotebook: z.string().optional().describe("目标笔记本 ID (moveDocs 操作)。"),
        toPath: z.string().optional().describe("目标路径 (moveDocs 操作)。"),
        fromIDs: z.array(z.string()).optional().describe("源块 ID 数组 (moveDocsByID 操作)。"),
        toID: z.string().optional().describe("目标块 ID (moveDocsByID 操作)。"),
        title: z.string().optional().describe("标题，例如重命名文档时使用。"),
        markdown: z.string().optional().describe("Markdown 内容 (createDocWithMd 操作)。"),
        tags: z.string().optional().describe("标签字符串，逗号分隔 (createDocWithMd 操作)。"),
        withMath: z.boolean().optional().describe("是否包含数学公式 (createDocWithMd 操作)。"),
        clippingHref: z.string().optional().describe("剪藏的原始链接 (createDocWithMd 操作)。"),
        listDocTree: z.boolean().optional().describe("操作后是否列出文档树 (某些 filetree 操作)。"),
        callback: z.string().optional().describe("回调标识字符串。"),
        typ: z.string().optional().describe("类型字符串或数字，用于属性视图等操作中指定类型 (例如 av.KeyType)。"),
        format: z.string().optional().describe("格式字符串，用于属性视图等操作中指定数字或日期格式 (例如 av.NumberFormat)。"),
        removeDest: z.boolean().optional().describe("在移除属性视图列时，是否删除目标数据 (avRemoveAttrViewCol 操作)。")
      }).describe("单个操作的定义。");

      // Transaction Schema for Request
      const transactionSchemaReq = z.object({
        timestamp: z.number().int().describe("事务时间戳，通常由前端生成或后端使用 reqId 覆盖（毫秒级）。"),
        doOperations: z.array(operationSchemaReq).min(1).describe("要执行的操作列表，至少包含一个操作。"),
        undoOperations: z.array(operationSchemaReq).optional().describe("可选的撤销操作列表。")
      }).describe("单个事务的定义。");

      return ({
        transactions: z.array(transactionSchemaReq).min(1).describe("一个或多个事务对象的数组，至少包含一个事务。"),
        reqId: z.number().int().describe("必需，请求的唯一ID (通常是客户端生成的时间戳，毫秒级)。"),
        app: z.string().describe("必需，发起请求的应用标识 (例如 \"SiYuan\")。"),
        session: z.string().describe("必需，当前会话ID (例如前端的 WebSocket clientID)。")
      });
    },
    zodResponseSchema: (z) => {
      // Operation Schema for Response (extends request schema by adding retData)
      const operationSchemaRes = z.object({
        action: z.string().describe("必需，具体的操作名称。"),
        id: z.string().optional().describe("操作目标块的 ID。"),
        parentID: z.string().optional().describe("父块 ID。"),
        previousID: z.string().optional().describe("前一个同级块 ID。"),
        nextID: z.string().optional().describe("后一个同级块 ID。"),
        data: z.any().optional().describe("操作的具体数据。"),
        dataType: z.string().optional().describe("数据类型。"),
        isDetached: z.boolean().optional().describe("是否为分离的操作。"),
        // Fields from kernel/model/transaction.go Operation struct
        box: z.string().optional().describe("块所属的笔记本 ID。"),
        path: z.string().optional().describe("块的存储路径。"),
        name: z.string().optional().describe("操作相关的名称。"),
        keyID: z.string().optional().describe("属性视图操作中的列 Key ID。"),
        avID: z.string().optional().describe("属性视图 ID。"),
        blockIDs: z.array(z.string()).optional().describe("块 ID 数组。"),
        deckID: z.string().optional().describe("闪卡包 ID。"),
        rowID: z.string().optional().describe("属性视图行 ID。"),
        srcID: z.string().optional().describe("源块 ID。"),
        targetID: z.string().optional().describe("目标块 ID。"),
        after: z.boolean().optional().describe("用于指定相对位置的布尔值。"),
        srcHeadingID: z.string().optional().describe("源标题块 ID。"),
        targetNoteBook: z.string().optional().describe("目标笔记本 ID。"),
        targetPath: z.string().optional().describe("目标路径。"),
        previousPath: z.string().optional().describe("前一个路径。"),
        srcListItemID: z.string().optional().describe("源列表项 ID。"),
        fromPaths: z.array(z.string()).optional().describe("源路径数组。"),
        toNotebook: z.string().optional().describe("目标笔记本 ID。"),
        toPath: z.string().optional().describe("目标路径。"),
        fromIDs: z.array(z.string()).optional().describe("源块 ID 数组。"),
        toID: z.string().optional().describe("目标块 ID。"),
        title: z.string().optional().describe("标题。"),
        markdown: z.string().optional().describe("Markdown 内容。"),
        tags: z.string().optional().describe("标签字符串。"),
        withMath: z.boolean().optional().describe("是否包含数学公式。"),
        clippingHref: z.string().optional().describe("剪藏的原始链接。"),
        listDocTree: z.boolean().optional().describe("操作后是否列出文档树。"),
        callback: z.string().optional().describe("回调标识字符串。"),
        typ: z.string().optional().describe("类型字符串或数字。"),
        format: z.string().optional().describe("格式字符串。"),
        removeDest: z.boolean().optional().describe("是否删除目标数据。"),
        // retData is the key difference in response
        retData: z.any().optional().describe("操作的执行结果。结构随 action 不同而变化。例如，updateBlock 成功时可能是 { \"updateCount\": 1 }。失败或无特定返回时可能为 null 或不返回此字段。")
      }).describe("单个操作的定义（响应中可能包含 retData）。");

      // Transaction Schema for Response
      const transactionSchemaRes = z.object({
        timestamp: z.number().int().describe("事务时间戳，与请求中的 reqId 一致（毫秒级）。"),
        doOperations: z.array(operationSchemaRes).min(1).describe("已执行的操作列表，其中 retData 可能包含操作结果。"),
        undoOperations: z.array(operationSchemaRes).optional().describe("对应的撤销操作列表（如果请求中提供）。")
      }).describe("单个事务的定义（响应）。");

      return ({
        code: z.number().int().describe("错误码，0 表示成功。其他值表示不同类型的错误。"),
        msg: z.string().describe("错误或成功信息。成功时通常为空字符串。"),
        data: z.array(transactionSchemaRes).nullable().describe("成功时返回处理后的事务数组。失败或无数据时为 null。")
      });
    }
  }
];
