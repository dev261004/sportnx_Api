import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import semver from "semver";
import logger from "../config/logger";

// Use process.cwd() for current working directory
const projectRoot = process.cwd();

// List all your modules here
const allModules = ["auth", "sports", "venues", "booking"];
const modules = process.argv[3]; // "auth/manager"
const bumpType = process.argv[2] || "patch";

const versionStorePath = path.resolve(
  projectRoot,
  "source/common/utils/version.json"
);
interface VersionStore {
  [key: string]: string | { [key: string]: string };
}

function loadVersionStore(): VersionStore {
  try {
    if (fs.existsSync(versionStorePath)) {
      return JSON.parse(fs.readFileSync(versionStorePath, "utf8"));
    }
  } catch (err: unknown) {
    throw new Error(`Failed to read version store: ${err}`);
  }
  return {};
}

function saveVersionStore(storeData: VersionStore) {
  try {
    fs.writeFileSync(versionStorePath, JSON.stringify(storeData, null, 2));
  } catch (err: unknown) {
    throw new Error(`Failed to write version store: ${err}`);
  }
}

function bumpModuleVersion(modulePath: string) {
  const pathParts = modulePath.split("/");
  const baseModule = pathParts[0];
  const subModule = pathParts[1];

  const storeData = loadVersionStore();

  if (subModule) {
    if (!storeData[baseModule] || typeof storeData[baseModule] === "string") {
      storeData[baseModule] = {};
    }

    const moduleConfig = storeData[baseModule] as { [key: string]: string };
    const currentVersion = moduleConfig[subModule] || "0.0.0";
    const nextVersion = semver.inc(
      currentVersion,
      bumpType as "patch" | "minor" | "major"
    );

    if (!nextVersion) {
      logger.error(`Failed to bump version for ${modulePath}`);
      return;
    }

    moduleConfig[subModule] = nextVersion;
    logger.info(
      `Updated ${modulePath} from ${currentVersion} → ${nextVersion}`
    );
  } else {
    // Handle main module (e.g., sports, venues)
    const currentVersion = (storeData[baseModule] as string) || "0.0.0";
    const nextVersion = semver.inc(
      currentVersion,
      bumpType as "patch" | "minor" | "major"
    );

    if (!nextVersion) {
      logger.error(`Failed to bump version for ${modulePath}`);
      return;
    }

    storeData[baseModule] = nextVersion;
    logger.info(
      `Updated ${modulePath} from ${currentVersion} → ${nextVersion}`
    );
  }

  saveVersionStore(storeData);
}

function getChangedModules() {
  const output = execSync("git diff --name-only HEAD", { encoding: "utf8" });
  const changedFiles = output.split("\n").filter(Boolean);
  const changedModules = new Set<string>();

  for (const file of changedFiles) {
    for (const module of allModules) {
      if (file.startsWith(`source/modules/${module}/`)) {
        // Check for submodules
        const relativePath = file.substring(`source/modules/${module}/`.length);
        const subModule = relativePath.split("/")[0];

        // If subModule exists and is not a file directly under module
        if (subModule && subModule !== "index.ts" && subModule !== "types.ts") {
          changedModules.add(`${module}/${subModule}`);
        } else {
          changedModules.add(module);
        }
      }
    }
  }
  return Array.from(changedModules);
}

// Main
function main() {
  if (modules) {
    logger.info(`Bumping version for specified module: ${modules}`);
    bumpModuleVersion(modules);
    return;
  }

  const changedModules = getChangedModules();
  logger.info("Changed modules:", changedModules);

  if (changedModules.length === 0) {
    logger.info("No modules changed. Nothing to update.");
    return;
  }

  for (const module of changedModules) {
    bumpModuleVersion(module);
  }
}

main();
