/**
 * 严格模式下直接访问protyle的一些属性会报错,因此需要守卫
 */
const getProtyleToolbar = (protyle:IProtyle)=>{
    if(!protyle.toolbar){
        console.error(protyle);
        throw new Error("protyle 结构错误,缺少工具栏");
    }
    return protyle.toolbar;
};
const getProtyleLute =(protyle:IProtyle)=>{
    if(!protyle.lute){
        console.error(protyle);
        throw new Error("protyle 结构错误,缺少工具栏");
    }
    return protyle.lute;
};