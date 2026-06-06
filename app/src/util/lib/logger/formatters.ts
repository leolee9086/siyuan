/**
 * 日志格式化工具函数
 * 
 * 本文件提供各种格式化功能，用于将原始数据转换为可读的日志信息
 */

/**
 * 格式化快捷键组合
 * 
 * 将键盘事件转换为可读的快捷键字符串
 * 
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取事件对象的属性（ctrlKey, altKey等）
 * 2. 事件对象在异步操作后可能失效
 * 3. 作为日志格式化函数，必须在事件处理的同一帧内完成
 * 
 * @param event - 键盘事件对象
 * @returns 格式化的快捷键字符串，如 "Ctrl+Enter"
 */
export const formatHotkey = (event: KeyboardEvent) => {
    const parts: string[] = [];
    
    if (event.ctrlKey) {
        parts.push("Ctrl");
    }
    if (event.altKey) {
        parts.push("Alt");
    }
    if (event.shiftKey) {
        parts.push("Shift");
    }
    if (event.metaKey) {
        parts.push("Meta");
    }
    
    // 添加主键（排除修饰键本身）
    const key = event.key;
    // @内联数组
    if (key && !["Control", "Alt", "Shift", "Meta"].includes(key)) {
        parts.push(key);
    }
    
    return parts.join("+");
};

/**
 * 从堆栈信息中提取文件路径
 *
 * 支持多种堆栈格式：
 * - 标准文件路径格式（开发环境）
 * - webpack-internal 格式（webpack 开发模式）
 * - 生产环境打包后的格式
 *
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅进行字符串解析，无需异步操作
 * 2. 作为日志格式化函数，需要立即返回结果
 * 3. 在事件处理流程中调用，必须同步完成
 *
 * @returns 文件路径信息
 */
export const extractCallerInfo = () => {
    const stack = new Error().stack || "";
    const lines = stack.split("\n");
    
    // 跳过前几行（Error、extractCallerInfo、logCommandExecution/logTaskToggle）
    // 找到实际调用日志的位置
    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
            continue;
        }
        
        // 格式1: webpack-internal 格式 - at functionName (webpack-internal:///./src/path/file.ts:line:col)
        let match = line.match(/at\s+\w+\s+\(webpack-internal:\/\/\/\.\/src\/(.+?\.ts):\d+:\d+\)/);
        // 匹配成功且捕获组1存在时，说明找到了 webpack-internal 格式的文件路径
        if (match && match[1]) {
            return `src/${match[1]}`;
        }
        
        // 格式2: webpack-internal 格式（无函数名） - at webpack-internal:///./src/path/file.ts:line:col
        match = line.match(/at\s+webpack-internal:\/\/\/\.\/src\/(.+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了 webpack-internal 格式的文件路径（无函数名变体）
        if (match && match[1]) {
            return `src/${match[1]}`;
        }
        
        // 格式3: 标准格式 - at functionName (path:line:col)
        match = line.match(/at\s+\w+\s+\(.*[/\\](app[/\\]src[/\\].+?\.ts):\d+:\d+\)/);
        // 匹配成功且捕获组1存在时，说明找到了标准格式的文件路径（带函数名）
        if (match && match[1]) {
            const filePath = match[1];
            return filePath.replace(/\\/g, "/");
        }
        
        // 格式4: 标准格式（无函数名） - at path:line:col
        match = line.match(/at\s+.*[/\\](app[/\\]src[/\\].+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了标准格式的文件路径（无函数名）
        if (match && match[1]) {
            const filePath = match[1];
            return filePath.replace(/\\/g, "/");
        }
        
        // 格式5: Firefox - functionName@path:line:col
        match = line.match(/@.*[/\\](app[/\\]src[/\\].+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了 Firefox 格式的文件路径
        if (match && match[1]) {
            const filePath = match[1];
            return filePath.replace(/\\/g, "/");
        }
        
        // 格式6: Firefox webpack-internal - functionName@webpack-internal:///./src/path/file.ts:line:col
        match = line.match(/@webpack-internal:\/\/\/\.\/src\/(.+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了 Firefox 下 webpack-internal 格式的文件路径
        if (match && match[1]) {
            return `src/${match[1]}`;
        }
    }
    
    // 如果所有格式都匹配失败，返回默认值（不输出警告，避免日志污染）
    return "未知文件";
};

/**
 * 获取块类型的中文描述
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取 DOM 元素的属性
 * 2. DOM 元素在异步操作后可能失效或被修改
 * 3. 作为日志格式化函数，必须在事件处理的同一帧内完成
 *
 * @param nodeElement - 块元素
 * @returns 块类型的中文描述
 */
export const getBlockTypeDescription = (nodeElement: HTMLElement) => {
    const dataType = nodeElement.getAttribute("data-type");
    const dataSubtype = nodeElement.getAttribute("data-subtype");
    
    const typeMap: Record<string, string> = {
        "NodeParagraph": "段落",
        "NodeHeading": "标题",
        "NodeList": "列表项",
        "NodeCodeBlock": "代码块",
        "NodeTable": "表格",
        "NodeBlockquote": "引用块",
        "NodeSuperBlock": "超级块",
        "NodeMathBlock": "数学公式块",
        "NodeHTMLBlock": "HTML块"
    };
    
    const subtypeMap: Record<string, string> = {
        "u": "无序列表项",
        "o": "有序列表项",
        "t": "任务列表项"
    };
    
    let description = typeMap[dataType || ""] || dataType || "未知类型";
    
    // 如果有子类型且在映射表中，使用更具体的描述
    if (dataSubtype && subtypeMap[dataSubtype]) {
        description = subtypeMap[dataSubtype];
    }
    
    return description;
};

/**
 * 获取命令的中文描述
 *
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅进行简单的字符串映射，无需异步操作
 * 2. 作为日志格式化函数，需要立即返回结果
 * 3. 在事件处理流程中调用，必须同步完成
 *
 * @param command - 命令标识符
 * @returns 命令的中文描述
 */
export const getCommandDescription = (command: string) => {
    const commandMap: Record<string, string> = {
        "CHECK_TOGGLE": "TOGGLE_TASK_STATUS",
        "OUTDENT": "LIST_OUTDENT",
        "INDENT": "LIST_INDENT",
        "TRANSFORM_TO_UL": "TRANSFORM_TO_UNORDERED_LIST",
        "TRANSFORM_TO_OL": "TRANSFORM_TO_ORDERED_LIST",
        "TRANSFORM_TO_TL": "TRANSFORM_TO_TASK_LIST",
        "TRANSFORM_TO_QUOTE": "TRANSFORM_TO_QUOTE",
        "IGNORE": "IGNORE"
    };
    
    return commandMap[command] || command;
};

/**
 * 获取任务状态的中文描述
 *
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅进行简单的布尔值映射，无需异步操作
 * 2. 作为日志格式化函数，需要立即返回结果
 * 3. 在事件处理流程中调用，必须同步完成
 *
 * @param isDone - 任务是否完成
 * @returns 任务状态的中文描述
 */
export const getTaskStatusDescription = (isDone: boolean) => {
    return isDone ? "已完成" : "未完成";
};