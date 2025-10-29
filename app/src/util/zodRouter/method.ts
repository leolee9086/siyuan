import z from "zod"
const methods = z.enum([
    'read','write'
])
type methodsType = z.infer<typeof methods>
/**
 * 实现一个实验性泛型类,能够根据上面的methods schema为自身注册方法
 * 例如 new routerExperiment<methodsType>() ,自身就会具有read和write方法
 * 然后这些方法能够通过schema进行类型安全地路由,路由的根据是ctx中的某个字段是否符合schema
 * 例如 new routerExperiment<methodsType,ctxSchema,inputSchema,outputSchema>()创建路由之后,就可以这样调用
 * router.write(<字段名>,matchSchema,middleWares)
 * 注意字段名会被校验是否被包含于传入的ctxSchema中
 */

class routerExperiment {
    
}