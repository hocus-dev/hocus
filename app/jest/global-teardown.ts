export default async (_globalConfig: any, _projectConfig: any) => {
  await (globalThis as any).stateManager.close();
};
