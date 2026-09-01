import { describe, it, expect, beforeEach,test, vi } from "vitest";

import { chain } from "../../../src/util/pathRouter/core/router.execution";
import { z } from "zod";
import { Context } from "../../../src/util/pathRouter/core/types";

describe("Router Schema Validation Error Handling", () => {
  it("should handle request schema validation error", async () => {
    const requestBodySchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const responseBodySchema = z.object({
      message: z.string(),
    });

    const { router, execute } = chain(requestBodySchema, responseBodySchema);

    router.post(
      "/",
      async (ctx, next) => {
        ctx.response.body = { message: "Hello" };
        await next();
      },
      {
        schema: {
          request: z.object({
            name: z.string().min(5),
          }),
        },
      }
    );

    const initialContext: Context<typeof requestBodySchema, typeof responseBodySchema> = {
      request: {
        method: "POST",
        url: "/",
        headers: {},
        body: {
          name: "test",
          age: 123,
        },
        params: {},
        query: {},
      },
      response: {
        status: 200,
        headers: {},
        body: {
          message: 134,
        },
      },
      method: "POST",
      path: "/",
      captures: [],
      params: {},
      status: 200,
      body: undefined,
      host:"example.com"
    };

    const result = await execute(initialContext);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain("Request validation failed");
  });

  it("should handle response schema validation error", async () => {
    const requestBodySchema = z.object({
      name: z.string(),
    });

    const responseBodySchema = z.object({
      message: z.string(),
      data: z.object({
        id: z.number(),
      }),
    });

    const { router, execute } = chain(requestBodySchema, responseBodySchema);

    router.post(
      "/",
      async (ctx, next) => {
        ctx.response.body = {
          message: "Hello",
          data: {
            //这里必须使用错误数据
            id: "this is not a number",
          },
        };
        await next();
      },
      {
        schema: {
          response: responseBodySchema,
        },
      }
    );

    const initialContext: Context<typeof requestBodySchema, typeof responseBodySchema> = {
      request: {
        method: "POST",
        url: "/",
        headers: {},
        body: {
          name: "test",
        },
        params: {},
        query: {},
      },
      response: {
        status: 200,
        headers: {},
        body: {
          message: "",
          data: {
            id: "测试",
          },
        },
      },
      method: "POST",
      path: "/",
      captures: [],
      params: {},
      status: 200,
      body: undefined,
      host:"example.com"
    };

    const result = await execute(initialContext);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain("Response validation failed");
  });
});