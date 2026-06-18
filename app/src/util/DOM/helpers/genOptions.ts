/**
 * 生成普通下拉框选项 HTML，统一字符串与 `{ label, name }` 两种输入格式。
 * 调用时机：桌面端外观设置等表单初始化时调用。
 * 问题/改进：当前直接拼接字符串，若后续需要统一转义策略可在这里集中处理。
 * @同步豁免: UI构建
 */
export const genOptions = (data: string[] | Array<{ label: string; name: string }>, key: string) => {
    let html = "";
    for (const item of data) {
        const isPlainValue = typeof item === "string";
        if (isPlainValue) {
            const isSelected = key === item;
            html += `<option value="${item}" ${isSelected ? "selected" : ""}>${item}</option>`;
            continue;
        }
        const isSelected = key === item.name;
        html += `<option value="${item.name}" ${isSelected ? "selected" : ""}>${item.label}</option>`;
    }
    return html;
};

/**
 * 生成语言下拉框选项 HTML，并在标签中附带语言代码帮助用户辨认。
 * 调用时机：语言相关设置面板渲染时调用。
 * 问题/改进：当前输出结构固定，如后续需要更复杂模板可拆成 DOM 构建版本。
 * @同步豁免: UI构建
 */
export const genLangOptions = (data: Array<{ label: string; name: string }>, key: string) => {
    let html = "";
    for (const item of data) {
        const isSelected = key === item.name;
        html += `<option value="${item.name}" ${isSelected ? "selected" : ""}>${item.label} (${item.name})</option>`;
    }
    return html;
};
