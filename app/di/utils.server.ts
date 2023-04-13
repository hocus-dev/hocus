import type { Provider, ProvidersOverrides } from "./injector.server";

export const overrideProviders = (
  providersArg: any,
  overrides: ProvidersOverrides<any>,
): Provider<any, any>[] => {
  const providers = providersArg as Provider<any, any>[];
  const result = [];
  for (const provider of providers) {
    const override = overrides[provider.token];
    if (override != null) {
      result.push({ token: provider.token, ...override });
    } else {
      result.push(provider);
    }
  }
  return result as any;
};
