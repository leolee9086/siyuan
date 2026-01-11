export const parseCDN = (Code) => {
    return parseMeta(Code, 'cdn')
}
export const parseMetas = (Code, types) => {
    const data = types.map(type => parseMeta(Code, type))
    const obj = {}
    data.array.forEach((typeData, i) => {
        obj[types[i]] = typeData.pop()
    });
}
/**
 * 解析meta
 * 找到代码中对import.meta的引用修改
 * @param {*} Code 
 * @returns 
 */
export const parseMeta = (Code, type) => {
    try {
        const lines = Code.split('\n')
        const cdnUrls = []
        // 定义了一个特殊格式的文件头
        let flag = false
        for (let i = 0; i < lines.length; i++) {
            try {
                walk(lines[i], cdnUrls, type, flag)
            } catch (e) {
                console.log(e)
            }
            if (flag) {
                break
            }
        }
        return cdnUrls.filter(url => url)
    } catch (e) {
        return [undefined]
    }
}
/**
 * 使用一点trick找到import.meta.cdn的调用
 * 所以token的解析会稍微简单一点
 */
const walk = (line, cdnUrls, type, flag) => {
    //强制定义必须以import.meta开头进行定义
    //如果到了某一个行，发现不是以import.meta开头，那么就停止解析
    //空行无所谓
    if (line.trim() && !line.trim().startsWith('import.meta')) {
        flag = true
        return
    }
    line = line.replace('import', 'importObj')
    const code = `
    return (()=>{
    importObj={
        meta:{${type}:''}
    }
    ${line}
    return importObj
    })()`
    const importObj = (new Function(code))()
    cdnUrls.push(importObj.meta[type])
}