import { Constants } from "../constants";

const generateTypeLabel = (type: string, isChecked: boolean): string => {
    return `<label class="fn__flex b3-label">
        <div class="fn__flex-1 fn__flex-center">
            ${type}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="${type}" type="checkbox" ${isChecked ? " checked" : ""}>
    </label>`;
};

export const filterTypesHTML = (types: IObject) => {
    let html = "";
    const sortedTypes = [...Constants.SIYUAN_ASSETS_SEARCH].sort((a: string, b: string) => {
        return a.localeCompare(b);
    });
    
    for (const type of sortedTypes) {
        html += generateTypeLabel(type, !!types[type]);
    }
    
    return html;
};
