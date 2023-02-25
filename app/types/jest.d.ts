declare namespace Mocha {
  /**
   * VSCode with multiple workspaces thinks the global `test` variable comes from Mocha
   * instead of Jest. This is a workaround to make it think it comes from Jest.
   */
  // @ts-ignore
  interface TestFunction extends jest.It {}
}
