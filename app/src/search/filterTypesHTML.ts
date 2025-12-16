import { Constants } from "../constants";

export const filterTypesHTML = (types: IObject) => {
    let html = "";
    Constants.SIYUAN_ASSETS_SEARCH.sort((a: string, b: string) => {
        return a.localeCompare(b);
    }).forEach((type: string) => {
        html += `<label class="fn__flex b3-label">
        <div class="fn__flex-1 fn__flex-center">
            ${type}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="${type}" type="checkbox" ${types[type] ? " checked" : ""}>
    </label>`;
    });
    return html;
};
