import Router from './router'
import { Context, createContextSchema } from './types'

import { z } from 'zod'


export function chain<
  TRequestBodySchema extends z.ZodObject<any>,
  TResponseBodySchema extends z.ZodObject<any>,
>(requestBodySchema: TRequestBodySchema, responseBodySchema: TResponseBodySchema): {
  execute: (initialContext: Context<TRequestBodySchema, TResponseBodySchema>) => Promise<Context<TRequestBodySchema, TResponseBodySchema>>,
  router: Router<TRequestBodySchema, TResponseBodySchema>
} {
  const extendedContextSchema = createContextSchema<TRequestBodySchema, TResponseBodySchema>(requestBodySchema, responseBodySchema)
  type ExtendedContext = z.infer<typeof extendedContextSchema>

  const router = new Router<TRequestBodySchema, TResponseBodySchema>()

  return {
    execute: async function executeChain(initialContext: Context<TRequestBodySchema, TResponseBodySchema>) {
      // 创建扩展的上下文，初始化执行状态
      const extendedContext: ExtendedContext = {
        ...initialContext,
        history: [],
        currentStep: undefined,
        previousStep: undefined,

      }
      let previousResult: any = extendedContext.response.body

      // 校验初始ctx
      let parsedResult = responseBodySchema.safeParse(previousResult)
      //执行路由
      const dispatch = router.routes()
      const dispatchPromise = dispatch(extendedContext, async () => { });
      await dispatchPromise;
      previousResult = extendedContext.response.body;
      parsedResult = responseBodySchema.safeParse(previousResult);
      if (parsedResult.success) {
        extendedContext.response.body = parsedResult.data
      } else {
        extendedContext.response.body = previousResult
      }
      return extendedContext
    },
    router
  }
}


