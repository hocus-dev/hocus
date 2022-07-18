import fs from "fs";

const filepath = "node_modules/prisma/build/index.js";
const extraExports = `module.exports = {Migrate, ensureDatabaseExists};`;
const contents = fs.readFileSync(filepath).toString();
if (!contents.endsWith(extraExports)) {
  const newContents = contents + `\n${extraExports}`;
  fs.writeFileSync(filepath, newContents);
}
