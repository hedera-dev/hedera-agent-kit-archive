/**
 * Generates a separate package.json for the ESM build in "dist/esm"
 * with { "type": "module" }, ensuring the module system is correctly
 * recognized and avoiding errors like:
 *
 * SyntaxError: Unexpected token 'export'
 */

const fs = require("fs");
const path = require("path");

const rootPackageJsonPath = path.join(process.cwd(), "package.json");
const esmPackageJsonPath = path.join(
  process.cwd(),
  "dist",
  "esm",
  "package.json"
);

function generateEsmPackageJson() {
  if (!fs.existsSync(rootPackageJsonPath)) return;

  const rootPackageJson = JSON.parse(
    fs.readFileSync(rootPackageJsonPath, "utf8")
  );

  rootPackageJson.type = "module";

  const esmDir = path.dirname(esmPackageJsonPath);
  if (!fs.existsSync(esmDir)) {
    fs.mkdirSync(esmDir, { recursive: true });
  }

  fs.writeFileSync(
    esmPackageJsonPath,
    JSON.stringify(rootPackageJson, null, 2),
    "utf8"
  );
}

generateEsmPackageJson();
