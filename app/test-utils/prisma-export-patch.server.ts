// Here we patch the Prisma client file to export some items which will
// be used to create temporary databases for testing.
import fs from "fs";

const filepath = "node_modules/prisma/build/index.js";
const extraExports = `module.exports = {Migrate, ensureDatabaseExists};`;
const contents = fs.readFileSync(filepath).toString();
if (!contents.endsWith(extraExports)) {
  const newContents = contents + `\n${extraExports}`;
  // As multiple processes might do this at the same time use move
  const rand = Math.floor(Math.random() * 10 ** 10).toString();
  fs.writeFileSync(filepath + rand, newContents);
  fs.renameSync(filepath + rand, filepath);
}
