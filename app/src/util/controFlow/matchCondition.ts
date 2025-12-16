type FlagValue = string | boolean | number | RegExp | Array<string | number | boolean>;
type FlagRecord = Record<string, FlagValue>;
type Conditions = Record<string, any>;

// 增强的匹配结果类型
interface MatchResult<T = any> {
  matched: boolean;
  handler?: Function;
  payload?: T;
}

// 支持payload类型推断的Matcher
type Matcher<T extends FlagRecord, P = void, R = any> = 
  (conditions: Conditions, payload?: P) => 
    | { matched: true; handler: Function; payload: R }
    | undefined;

// 创建类型安全的匹配器
export const createTypedMatcher = <
  T extends FlagRecord,
  P = void, // payload参数类型，默认为void（无参数）
  R = void  // handler返回类型，默认为void
>(
  flag: T, 
  handler: (payload: P) => R
): Matcher<T, P, R> => {
  return (conditions: Conditions, payload?: P) => {
    for (const [key, flagValue] of Object.entries(flag)) {
      const conditionValue = conditions[key];
      
      if (conditionValue === undefined) return undefined;
      
      if (flagValue instanceof RegExp) {
        if (typeof conditionValue !== "string" || !flagValue.test(conditionValue)) {
          return undefined;
        }
      } else if (Array.isArray(flagValue)) {
        if (!flagValue.includes(conditionValue)) {
          return undefined;
        }
      } else {
        if (flagValue !== conditionValue) {
          return undefined;
        }
      }
    }
    
    return {
      matched: true,
      handler,
      payload: handler(payload as P)
    } as const;
  };
};

// 使用示例
// 1. 无payload的匹配器
const adminMatcher = createTypedMatcher(
  { role: "admin", enabled: true },
  () => ({ permissions: ["read", "write", "delete"] })
);

// 2. 带字符串payload的匹配器
const userMatcher = createTypedMatcher(
  { role: "user", plan: /^(pro|enterprise)$/ },
  (userId: string) => ({ userId, features: ["read", "write"] })
);

// 3. 带对象payload的匹配器
const analyticsMatcher = createTypedMatcher(
  { analytics: true, version: [1, 2] },
  (config: { trackingId: string; events: string[] }) => ({
    ...config,
    enabled: true
  })
);

// 4. 带可选payload的匹配器
const guestMatcher = createTypedMatcher(
  { role: "guest" },
  (sessionId?: string) => ({
    sessionId: sessionId || "anonymous",
    permissions: ["read"]
  })
);

// 测试使用
const conditions1 = { role: "admin", enabled: true };
const result1 = adminMatcher(conditions1);
// result1.payload 类型为 { permissions: string[] }

const conditions2 = { role: "user", plan: "pro" };
const result2 = userMatcher(conditions2, "user-123");
// result2.payload 类型为 { userId: string; features: string[] }

const conditions3 = { analytics: true, version: 2 };
const result3 = analyticsMatcher(conditions3, { 
  trackingId: "UA-123", 
  events: ["click", "pageview"] 
});
// result3.payload 类型为 { trackingId: string; events: string[]; enabled: boolean }
