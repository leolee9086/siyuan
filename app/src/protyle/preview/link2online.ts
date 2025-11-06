import { Constants } from "../../constants";
import { needSubscribe } from "../../util/needSubscribe";
import { getSiyuanUser } from "../../util/siyuanEnvironments/getSiyuanConfig";

export const processWithSiyuanCDN = (copyElement: HTMLElement) => {
    if (needSubscribe("")) {
        return;
    }
    copyElement.querySelectorAll("[href],[src]").forEach(item => {
        const oldLink = item.getAttribute("href") || item.getAttribute("src");
        if (oldLink && oldLink.startsWith("assets/")) {
            const newLink = Constants.ASSETS_ADDRESS + getSiyuanUser().userId + "/" + oldLink;
            if (item.getAttribute("href")) {
                item.setAttribute("href", newLink);
            } else {
                item.setAttribute("src", newLink);
            }
        }
    });
}

//暂时默认仅仅使用思源的会员CDN
export const link2online = (copyElement: HTMLElement,adapterName:string='siyuan')=>{
    if(adapterName==='siyuan'){
        processWithSiyuanCDN(copyElement)
    }
}