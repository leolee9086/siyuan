// 标准化路径：将所有反斜杠替换为正斜杠，并修正双斜杠问题
function 标准化路径(name) {
    name = name.replace(/\\/g, "/");
    name = name.replace("//", "/");
    return name;
}

// 修正协议：确保http和https协议格式正确
function 修正协议(name) {
    if (name.startsWith("http:/")) {
        name = name.replace("http:/", "http://");
    }
    if (name.startsWith("https:/")) {
        name = name.replace("https:/", "https://");
    }
    return name;
}

// 检查并转换特定格式的路径
function 转换特定格式路径(name) {
    const reg = /^\d{14}\-[0-9a-z]{7}$/;
    if (reg.test(name)) {
        return `./${name}.js`;
    }
    return null;
}

// 构建导入路径
function 构建导入路径(name) {
    if (name.startsWith("./") || name.startsWith("../") || name.startsWith("/") ||
        name.startsWith("http://") || name.startsWith("https://")) {
        return name;
    } else {
        return "https://esm.sh/" + name;
    }
}

// 主函数：重写导入
export function 重写导入(导入声明) {
    try {
        let name = 导入声明.n;
        name = 标准化路径(name);
        name = 修正协议(name);
        const 特定格式路径 = 转换特定格式路径(name);
        if (特定格式路径) {
            return 特定格式路径;
        }
        return 构建导入路径(name);
    } catch (error) {
        console.error("重写导入时发生错误：", error);
        // 根据需要处理错误或返回默认值
        return null; // 或者返回一个默认的导入路径
    }
}