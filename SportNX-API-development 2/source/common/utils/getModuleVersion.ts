// source/common/utils/getModuleVersion.ts
import path from "path";
import fs from "fs";

export function getModuleVersion(module: string, submodule?: string): string {
  const versionPath = path.resolve(__dirname, "version.json");
  const versionData = JSON.parse(fs.readFileSync(versionPath, "utf8"));
  if (submodule) {
    return versionData[module]?.[submodule] || "0.0.0";
  }
  return versionData[module] || "0.0.0";
}
