import { 
    cosineSimilarity,
    getLuminance,
    getHue 
} from "./colorProcessor.js";
export function 按照相似度排序颜色(colors){
    return colors.sort((a, b) => cosineSimilarity(b, a) - cosineSimilarity(a, b));
}
export function 按照明度排序颜色(colors){
    return colors.sort((a, b) => getLuminance(a) - getLuminance(b));
}

export function 按照色相排序颜色(colors){
    return colors.sort((a, b) => getHue(a) - getHue(b));
}