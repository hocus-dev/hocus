import { bundleWorkflowCode, type WorkflowBundleWithSourceMap } from "@temporalio/worker";

export async function generateTemporalCodeBundle(): Promise<WorkflowBundleWithSourceMap> {
  return await bundleWorkflowCode({
    workflowsPath: require.resolve("~/agent/workflows"),
    payloadConverterPath: require.resolve("~/temporal/data-converter"),
    webpackConfigHook: (config) => {
      ((config.resolve as any).alias as any)["~"] = "/app";
      return config;
    },
  });
}
