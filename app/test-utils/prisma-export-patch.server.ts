// Here we patch the Prisma client file to export some items which will
// be used to create temporary databases for testing.
import fs from "fs";

const filepath = "node_modules/prisma/build/index.js";
const extraExports = `module.exports = {Migrate, ensureDatabaseExists};`;
const contents = fs.readFileSync(filepath).toString();
const stat = fs.statSync(filepath);
if (!contents.endsWith(extraExports)) {
  const newContents = contents + `\n${extraExports}`;
  // As multiple processes might do this at the same time use move
  const rand = Math.floor(Math.random() * 10 ** 10).toString();
  const dstPath = filepath + rand;
  fs.writeFileSync(dstPath, newContents, { mode: stat.mode });
  fs.chownSync(dstPath, stat.uid, stat.gid);
  fs.renameSync(dstPath, filepath);
}
