import { createInjector } from "typed-inject";

import { CONFIG_INJECT_TOKEN, getConfig } from "~/config";

export const createAppInjector = () =>
  createInjector().provideValue(CONFIG_INJECT_TOKEN, getConfig());
