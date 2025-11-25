import { createApiFetcher } from "./apiFetcher";
import { accountApiDefs } from "./account";
import { aiApiDefs } from "./ai";

/**
 * 创建账户相关的 API Fetcher 实例
 */
const createAccountFetcher = (config: { host: string; port?: number; protocol?: "http" | "https" }) => {
  const fetcher = createApiFetcher(config);
  const withAccount = fetcher.$use(accountApiDefs);
  const withAI = withAccount.$use(aiApiDefs);
  return withAI;
};

export let fetcher = createAccountFetcher({ host: "localhost", port: 3000, protocol: "http" })
