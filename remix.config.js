/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*", "**/*.*.ts"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/index.js",
  server: process.env.NODE_ENV === "production" ? "entrypoints/server.ts" : void 0,
  publicPath: "/build/",
};
