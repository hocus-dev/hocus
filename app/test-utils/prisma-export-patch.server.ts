// Here we patch the Prisma client file to export some items which will
// be used to create temporary databases for testing.
import fs from "fs";

const filepath = "node_modules/prisma/build/index.js";
const extraExports = `module.exports = {Migrate, ensureDatabaseExists};`;
const contents = fs.readFileSync(filepath).toString();
if (!contents.endsWith(extraExports)) {
  const newContents = contents + `\n${extraExports}`;
  fs.writeFileSync(filepath, newContents);
}
