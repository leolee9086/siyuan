export const genOptions = (data: string[] | { label: string, name: string }[], key: string) => {
    let html = "";
    for (const item of data) {
        if (typeof item === "string") {
            html += `<option value="${item}" ${key === item ? "selected" : ""}>${item}</option>`;
            continue;
        }
        html += `<option value="${item.name}" ${key === item.name ? "selected" : ""}>${item.label}</option>`;
    }
    return html;
};

export const genLangOptions = (data: { label: string, name: string }[], key: string) => {
    let html = "";
    for (const item of data) {
        html += `<option value="${item.name}" ${key === item.name ? "selected" : ""}>${item.label} (${item.name})</option>`;
    }
    return html;
};

