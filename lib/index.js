import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import promptSync from "prompt-sync";
import chalk from "chalk";
import semver from "semver";
import "./zip.js";
import { exec } from "child_process";
import * as CommentJSON from "comment-json";
import { stdout } from "process";
// import progress from "progress";
/**
 * The version of the script.
 */
export const format_version = "1.11.0";
//---------------------------------------------------------------------------
// Arguments
//---------------------------------------------------------------------------
/**
 * The arguments passed to the script.
 */
const args = process.argv.slice(2);
/**
 * The flags passed to the script.
 */
const flagsArgs = args.slice(0, ((v) => (v === -1 ? args.length : v))(args.findIndex((arg) => !arg.startsWith("-"))));
/**
 * The non-flag arguments passed to the script.
 */
const nonFlagsArgs = args.slice(flagsArgs.length);
/**
 * The path to the config file to use for {@link configData}.
 */
let configPath = flagsArgs.find((arg) => arg.startsWith("--config="))?.slice("--config=".length);
if (configPath !== undefined) {
    if (!configPath) {
        configPath = undefined;
    }
    else {
        if (!existsSync(configPath)) {
            throw new ReferenceError(chalk.red(`The config file "${configPath}" does not exist.`));
        }
    }
}
/**
 * The path to the Minecraft version folder.
 */
let versionFolderPath = flagsArgs.find((arg) => arg.startsWith("--version-folder="))?.slice("--version-folder=".length);
if (versionFolderPath !== undefined) {
    if (!versionFolderPath) {
        versionFolderPath = undefined;
    }
    else {
        if (!existsSync(versionFolderPath)) {
            throw new ReferenceError(chalk.red(`The folder "${versionFolderPath}" does not exist.`));
        }
    }
}
/**
 * Whether debug logging is enabled.
 */
const enableDebugLogging = flagsArgs.some((arg) => arg.toLowerCase() === "--debug");
const sourceWebsite = new URL(flagsArgs
    .find((arg) => arg.toLowerCase().startsWith("--source-website"))
    ?.slice("--source-website=".length)
    .replace(/(?<!\/)$/, "/") || "https://www.8crafter.com/").href;
/**
 * The mode of the script.
 */
const mode = flagsArgs.includes("-r") || flagsArgs.includes("--uninstall")
    ? "uninstall"
    : flagsArgs.includes("-ec") || flagsArgs.includes("--exportconfig")
        ? "exportConfig"
        : "install";
//---------------------------------------------------------------------------
// Check if Minecraft is running.
if (mode === "uninstall" && (await checkIfProcessIsRunning("Minecraft.Windows.exe"))) {
    console.error(chalk.red("Minecraft is running. Please close it before using this script."));
    process.exit(1);
}
/**
 * Gets a data URI to use to import the 8Crafter's Ore UI Customizer API.
 *
 * @returns {Promise<string>} A promise resolving with the data URI to use to import the 8Crafter's Ore UI Customizer API.
 */
async function getOreUICustomizerAPIDataURI() {
    const baseURL = new URL("./api/dependency_lists/", sourceWebsite).href;
    const dependenciesData = (await (await fetch(new URL("ore-ui-customizer-api.dependencies.json", baseURL).href)).json());
    let scriptData = /* readFileSync(
        path.join(import.meta.dirname, "./ore-ui-customizer-api.js")
    ).toString(); */ await (await fetch(new URL(dependenciesData.main_script.js, baseURL).href)).text();
    async function applyDependencies(dependencies, targetString) {
        for (const dependency of dependencies) {
            let dependencyScriptData = await (await fetch(new URL(dependency.js, baseURL).href)).text();
            dependency.dependencies && (dependencyScriptData = await applyDependencies(dependency.dependencies, dependencyScriptData));
            const dependencyScriptDataURI = `data:text/javascript;base64,${Buffer.from(dependencyScriptData).toString("base64")}`;
            targetString = targetString.replaceAll(dependency.currentImportStatementText, dependencyScriptDataURI);
        }
        return targetString;
    }
    scriptData = await applyDependencies(dependenciesData.dependencies, scriptData);
    const scriptDataURI = `data:text/javascript;base64,${Buffer.from(scriptData).toString("base64")}`;
    return scriptDataURI;
}
await getOreUICustomizerAPIDataURI();
/**
 * API for 8Crafter's Ore UI Customizer.
 *
 * @see {@link https://www.8crafter.com/api/ore-ui-customizer-api.js}
 * @see {@link https://www.8crafter.com/assets/shared/ore-ui-customizer-assets.js}
 * @see {@link https://www.8crafter.com/utilities/ore-ui-customizer}
 */
export const oreUICustomizerAPI = await import(await getOreUICustomizerAPIDataURI(), { with: {} });
/**
 * A function to get user input.
 *
 * @see {@link https://www.npmjs.com/package/prompt-sync}
 */
const prompt = promptSync({ sigint: true });
/**
 * The path to the user folder.
 *
 * This is the same folder you are sent to if your type `%AppData%/../../` in the `WIN+R` Run dialog.
 */
export const userFolderPath = import.meta.dirname.split(path.sep).slice(0, 3).join(path.sep);
// Check if the user folder path is valid.
if (!new RegExp(`[A-Z]:${path.sep === "\\" ? "\\\\" : path.sep}Users${path.sep === "\\" ? "\\\\" : path.sep}`).test(userFolderPath)) {
    console.error(`Invalid user folder path, please make sure this package is installed globally: "${userFolderPath}"`);
    process.exit(1);
}
/**
 * The path to the Bedrock Launcher data folder.
 */
export const mcBedrockFolderPath = path.join(userFolderPath, "AppData/Roaming/.minecraft_bedrock");
/**
 * The type of Minecraft Bedrock Edition installation to install 8Crafter's Ore UI Customizer on.
 */
let accessType = "BedrockLauncher";
/**
 * The folder for the Minecraft Bedrock Edition version to install 8Crafter's Ore UI Customizer on.
 */
let versionFolder;
/**
 * The settings for 8Crafter's Ore UI Customizer.
 */
let configData = undefined;
/**
 * The format version of the settings for 8Crafter's Ore UI Customizer.
 */
let configDataVersion = undefined;
if (configPath) {
    if (path.extname(configPath) === ".json") {
        const data = CommentJSON.parse(readFileSync(configPath).toString());
        if ("format_version" in data) {
            configData = { ...data };
            delete configData["format_version"];
            configDataVersion = data.format_version;
        }
        else {
            configData = data.oreUICustomizerConfig;
            configDataVersion = data.oreUICustomizerVersion;
        }
    }
    else if (path.extname(configPath) === ".js") {
        const data = await readJSCustomizerConfigFile(configPath);
        configData = data?.oreUICustomizerConfig;
        configDataVersion = data?.oreUICustomizerVersion;
    }
    else {
        throw new TypeError("Config file must be a JSON or JavaScript file.");
    }
    if (!configData || !configDataVersion) {
        throw new TypeError("There was an error parsing the config file: " +
            (!configData && !configDataVersion ? "No config data or version found." : !configData ? "No config data found." : "No config version found."));
    }
    console.log(`Using config file: ${configPath}`);
}
if (versionFolderPath) {
    versionFolder = versionFolderPath;
    accessType = "BedrockLauncher";
}
else {
    try {
        /**
         * The path to the Bedrock Launcher versions folder.
         */
        const mcBedrockVersionsFolderPath = path.join(mcBedrockFolderPath, "versions");
        /**
         * The list of folders for all the currently installed Minecraft Bedrock Edition versions.
         */
        const bedrockLauncherVersionFolders = readdirSync(mcBedrockVersionsFolderPath).filter((versionFolder) => versionFolder !== "AppxBackups"); /*
        const versionFolderCreationTimeMap: Map<string, number> = new Map();
        for (const versionFolder of bedrockLauncherVersionFolders) {
            const versionFolderCreationTime: number = statSync(path.join(mcBedrockVersionsFolderPath, versionFolder)).birthtimeMs;
            versionFolderCreationTimeMap.set(versionFolder, versionFolderCreationTime);
        }
        bedrockLauncherVersionFolders.sort((a, b) => versionFolderCreationTimeMap.get(b)! - versionFolderCreationTimeMap.get(a)!); */
        accessType = "BedrockLauncher";
        if (bedrockLauncherVersionFolders.length > 1) {
            const versionNumbers = bedrockLauncherVersionFolders.map((versionFolder) => {
                const AppxManifestXML = path.join(mcBedrockVersionsFolderPath, versionFolder, "AppxManifest.xml");
                const AppxManifestXMLContent = readFileSync(AppxManifestXML, "utf-8");
                const AppxManifestXMLVersion = AppxManifestXMLContent.match(/\<Identity Name="(?:Microsoft\.MinecraftUWP|Microsoft\.MinecraftWindowsBeta)" Publisher="[^"]*" Version="([\d\.]+)"/)?.[1];
                const [AppxManifestPhoneProductId, AppxManifestPhonePublisherId] = AppxManifestXMLContent.match(/\<mp:PhoneIdentity PhoneProductId="([a-f0-9\-]+)" PhonePublisherId="([a-f0-9\-]+)" \/\>/)?.slice(1, 3);
                if (!AppxManifestXMLVersion) {
                    return "Unable to determine version.";
                }
                const AppxManifestXMLEdition = AppxManifestXMLContent.match(/\<Identity Name="(Microsoft\.MinecraftUWP|Microsoft\.MinecraftWindowsBeta)" Publisher="[^"]*" Version="(?:[\d\.]+)"/)?.[1];
                const versionSegments = AppxManifestXMLVersion.split(".");
                let version;
                if (versionSegments[0] === "0") {
                    if (versionSegments[1].length < 4) {
                        version = `0.${Number(versionSegments[1]?.slice(0, -1))}.${Number(versionSegments[1]?.slice(-1))}.${Number(versionSegments[2])}`;
                    }
                    else {
                        version = `0.${Number(versionSegments[1]?.slice(0, -2))}.${Number(versionSegments[1]?.slice(-2))}.${Number(versionSegments[2])}`;
                    }
                }
                else {
                    version = `${Number(versionSegments[0])}.${Number(versionSegments[1])}.${Number(versionSegments[2]?.slice(0, -2))}.${Number(versionSegments[2]?.slice(-2))}`;
                }
                return `${version} (${AppxManifestXMLEdition === "Microsoft.MinecraftUWP"
                    ? "Release"
                    : AppxManifestXMLEdition === "Microsoft.MinecraftWindowsBeta"
                        ? "Preview"
                        : "Unknown"}${AppxManifestPhonePublisherId === "00000000-0000-0000-0000-000000000000" ? " [Dev]" : ""})`;
            });
            /**
             * A map of version number to version folder.
             */
            const versionNumberToFolderMap = new Map();
            /**
             * A map of version folder to version number.
             */
            const versionFolderToNumberMap = new Map();
            /**
             * Create a map of version number to version folder and version folder to version number.
             */
            for (const [v, i] of versionNumbers.map((v, i) => [v, i])) {
                versionNumberToFolderMap.set(v, bedrockLauncherVersionFolders[i]);
                versionFolderToNumberMap.set(bedrockLauncherVersionFolders[i], v);
            }
            /**
             * Sort the {@link versionNumbers} array from highest to smallest version number.
             */
            versionNumbers.sort((a, b) => a === "Unable to determine version." && b !== "Unable to determine version."
                ? 1
                : a !== "Unable to determine version." && b === "Unable to determine version."
                    ? -1
                    : a === b
                        ? 0
                        : semver.compare(b
                            .slice(0, b.indexOf(" ("))
                            .trim()
                            .split(".")
                            .map((v, i) => (i === 3 ? "-" + v : i === 0 ? v : "." + v))
                            .join("")
                            .trim(), a
                            .slice(0, a.indexOf(" ("))
                            .trim()
                            .split(".")
                            .map((v, i) => (i === 3 ? "-" + v : i === 0 ? v : "." + v))
                            .join("")
                            .trim()));
            /**
             * Sort the {@link bedrockLauncherVersionFolders} array from highest to smallest version number.
             */
            for (const [v, i] of versionNumbers.map((v, i) => [v, i])) {
                bedrockLauncherVersionFolders[i] = versionNumberToFolderMap.get(v);
            }
            process.stdout.write(`${chalk.yellowBright(`Multiple Minecraft versions were found, please enter the number of the Minecraft version to ${mode === "install"
                ? "install 8Crafter's Ore UI Customizer on"
                : mode === "uninstall"
                    ? "uninstall 8Crafter's Ore UI Customizer from"
                    : "export the config of 8Crafter's Ore UI Customizer from"}:`)}\n${(() => {
                const versionList = versionNumbers.map((v, i) => `${(chalk.rgb(0, 255, 136)(i + 1) + ": ").padStart(String(versionNumbers.length).length + 2 + chalk.rgb(0, 255, 136)(i + 1).length - String(i + 1).length, " ")}${v === "Unable to determine version."
                    ? chalk.red(v)
                    : `${chalk.rgb(0, 255, 255)(v.split(" ")[0])} (${((stage, dev) => (stage === "Release"
                        ? chalk.rgb(0, 255, 0)("Release")
                        : stage === "Preview"
                            ? chalk.rgb(255, 255, 0)("Preview")
                            : stage === "Unknown"
                                ? chalk.rgb(255, 0, 0)("Unknown")
                                : stage) + (dev === "[Dev]" ? " [" + chalk.rgb(255, 0, 0)("Dev") + "]" : ""))(...v
                        .replaceAll(/[\(\)]/g, "")
                        .split(" ")
                        .slice(1))})`}`);
                const baseLength = Math.min(versionNumbers.reduce((previousValueLength, value, i) => Math.max(previousValueLength, value.length + String(i + 1).length), 0) + 7, stdout.getWindowSize()[0]);
                return versionList
                    .map((v, i) => (i % 2 === 0 ? chalk.bgRgb(25, 25, 25) : chalk.bgRgb(0, 0, 0))(v.padEnd(baseLength + v.length - versionNumbers[i].length - 2, " ")))
                    .join("\n");
            })()}\n`);
            /**
             * Prompt the user to select a Minecraft version.
             */
            let folderSelection = prompt("Selection: ");
            folderSelection = folderSelection.trim();
            // If the user entered an invalid folder selection, log an error to the console and exit.
            if (!Number(folderSelection) || Number(folderSelection) < 1 || Number(folderSelection) > versionNumbers.length) {
                console.error("Invalid folder selection, please try again.");
                process.exit(1);
            }
            versionFolder = path.join(mcBedrockVersionsFolderPath, bedrockLauncherVersionFolders[Number(folderSelection) - 1]);
            if (!configData) {
                try {
                    try {
                        const data = await getCurrentCustomizerConfigurationAndVersion(versionFolder);
                        configData = data?.oreUICustomizerConfig;
                        configDataVersion = data?.oreUICustomizerVersion; /*
                        if (existsSync(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
                            configData = await import(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"));
                        } */
                    }
                    catch { }
                    if (!configData) {
                        /**
                         * The release stage of the Minecraft Bedrock Edition version the user selected.
                         */
                        const selectionReleaseStage = versionFolderToNumberMap.get(versionFolder).endsWith("(Preview)")
                            ? "Preview"
                            : versionFolderToNumberMap.get(versionFolder).endsWith("(Release)")
                                ? "Release"
                                : undefined;
                        /**
                         * The version folders ordered by the order they should be searched for an Ore UI Customizer config file in.
                         */
                        const bedrockLauncherVersionFoldersOrderedByConfigSearchOrder = selectionReleaseStage === undefined
                            ? bedrockLauncherVersionFolders
                            : [
                                ...bedrockLauncherVersionFolders.filter((versionFolder) => versionFolderToNumberMap.get(versionFolder)?.endsWith(selectionReleaseStage)),
                                ...bedrockLauncherVersionFolders.filter((versionFolder) => !versionFolderToNumberMap
                                    .get(versionFolder)
                                    ?.endsWith(selectionReleaseStage === "Preview" ? "Release" : "Preview")),
                                ...bedrockLauncherVersionFolders.filter((versionFolder) => versionFolderToNumberMap.get(versionFolder) === "Unable to determine version."),
                            ];
                        /**
                         * Search for the Ore UI Customizer config file in the version folders.
                         */
                        for (const versionFolderToSearch of bedrockLauncherVersionFoldersOrderedByConfigSearchOrder) {
                            if (versionFolderToSearch === versionFolder) {
                                continue;
                            }
                            try {
                                const data = await getCurrentCustomizerConfigurationAndVersion(versionFolderToSearch);
                                configData = data?.oreUICustomizerConfig;
                                configDataVersion = data?.oreUICustomizerVersion;
                                /* if (!existsSync(path.join(versionFolderToSearch, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
                                    continue;
                                }
                                configData = await import(path.join(versionFolderToSearch, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js")); */
                                if (configData) {
                                    break;
                                }
                            }
                            catch { }
                        }
                    }
                }
                catch { }
            }
        }
        else if (bedrockLauncherVersionFolders.length === 1) {
            versionFolder = path.join(mcBedrockVersionsFolderPath, bedrockLauncherVersionFolders[0]);
            try {
                const data = await getCurrentCustomizerConfigurationAndVersion(bedrockLauncherVersionFolders[0]);
                configData = data?.oreUICustomizerConfig;
                configDataVersion = data?.oreUICustomizerVersion;
            }
            catch { }
        }
        else {
            console.error(chalk.red("No Minecraft Bedrock versions found. If you are using a custom Minecraft Bedrock Edition launcher other than Bedrock Launcher, please use the --version-folder option to specify the version folder to install the Ore UI Customizer on, refer the the README for more information."));
            process.exit(1);
        }
    }
    catch (e) {
        const WindowsAppsFolders = readdirSync(path.join(path.parse(userFolderPath).root, "Program Files", "WindowsApps"));
        if (WindowsAppsFolders.some((folder) => folder.startsWith("Microsoft.MinecraftUWP") || folder.startsWith("Microsoft.MinecraftWindowsBeta"))) {
            const minecraftVersionFolders = WindowsAppsFolders.filter((folder) => folder.startsWith("Microsoft.MinecraftUWP") || folder.startsWith("Microsoft.MinecraftWindowsBeta"));
            accessType = "IObit Unlocker";
            if (minecraftVersionFolders.length > 2) {
                console.error("Found too many Minecraft installations, there are more than 2 folders in the WindowsApps folder starting with 'Microsoft.MinecraftUWP' or 'Microsoft.MinecraftWindowsBeta'.");
                process.exit(1);
            }
            if (minecraftVersionFolders.length === 2) {
                const selectPreviewInput = prompt({
                    ask: `Would you like to ${mode === "install"
                        ? "install 8Crafter's Ore UI Customizer on"
                        : mode === "uninstall"
                            ? "uninstall 8Crafter's Ore UI Customizer from"
                            : "export the config of 8Crafter's Ore UI Customizer from"} the Minecraft Preview or Release version?\n1: Release\n2: Preview\nSelection: `,
                }).trim();
                if (!["1", "2"].includes(selectPreviewInput)) {
                    console.error(`Invalid selection: ${JSON.stringify(selectPreviewInput)}, expected either 1 or 2.`);
                    process.exit(1);
                }
                const selectPreview = selectPreviewInput === "2";
                versionFolder = path.join(path.parse(userFolderPath).root, "Program Files", "WindowsApps", selectPreview
                    ? minecraftVersionFolders.find((folder) => folder.startsWith("Microsoft.MinecraftWindowsBeta"))
                    : minecraftVersionFolders.find((folder) => folder.startsWith("Microsoft.MinecraftUWP")) /* "Microsoft.MinecraftUWP_8wekyb3d8bbwe" */);
                try {
                    try {
                        if (existsSync(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
                            const data = await getCurrentCustomizerConfigurationAndVersion(versionFolder);
                            configData = data?.oreUICustomizerConfig;
                            configDataVersion = data?.oreUICustomizerVersion;
                        }
                    }
                    catch { }
                    if (!configData) {
                        try {
                            const otherVersionFolder = minecraftVersionFolders.find((folder) => folder !== versionFolder);
                            if (existsSync(path.join(otherVersionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
                                const data = await getCurrentCustomizerConfigurationAndVersion(otherVersionFolder);
                                configData = data?.oreUICustomizerConfig;
                                configDataVersion = data?.oreUICustomizerVersion;
                            }
                        }
                        catch { }
                    }
                }
                catch { }
            }
            else {
                versionFolder = path.join(path.parse(userFolderPath).root, "Program Files", "WindowsApps", minecraftVersionFolders[0]);
                if (!configData) {
                    try {
                        if (existsSync(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
                            const data = await getCurrentCustomizerConfigurationAndVersion(versionFolder);
                            configData = data?.oreUICustomizerConfig;
                            configDataVersion = data?.oreUICustomizerVersion;
                        }
                    }
                    catch { }
                }
            }
        }
        else if (readdirSync(path.join(path.parse(userFolderPath).root, "Program Files")).some((folder) => folder.startsWith("BedrockLauncher"))) {
            accessType = "BedrockLauncher";
            console.error(`Bedrock Launcher was detected but something went wrong, the following error occurred: ${e}${e?.stack}`);
            process.exit(1);
        }
        else {
            console.error("Minecraft Bedrock Edition installation not found.");
            process.exit(1);
        }
    }
}
/**
 * Copies a folder.
 *
 * @param {string} folder The folder to copy.
 * @param {string} destination The destination folder.
 */
export function copyFolder(folder, destination) {
    try {
        mkdirSync(destination, { recursive: true });
    }
    catch (e) { }
    const folderContents = readdirSync(folder, { withFileTypes: true });
    for (const item of folderContents) {
        if (item.isFile()) {
            copyFileSync(path.join(folder, item.name), path.join(destination, item.name));
        }
        else if (item.isDirectory()) {
            try {
                mkdirSync(path.join(destination, item.name), { recursive: true });
            }
            catch (e) {
                console.error(e, e?.stack);
            }
            copyFolder(path.join(folder, item.name), path.join(destination, item.name));
        }
    }
}
/**
 * Copies a folder using IObit Unlocker per file.
 *
 * @param {string} folder The folder to copy.
 * @param {string} destination The destination folder.
 * @returns {Promise<void>} A promise that resolves when the folder is copied.
 */
export async function copyFolderIObitPerFileMode(folder, destination) {
    try {
        mkdirSync(destination, { recursive: true });
    }
    catch (e) { }
    const folderContents = readdirSync(folder, { withFileTypes: true });
    const listOfFilesToCopy = [];
    for (const item of folderContents) {
        if (item.isFile()) {
            listOfFilesToCopy.push(path.join(folder, item.name));
        }
        else if (item.isDirectory()) {
            /* try {
                mkdirSync(path.join(destination, item.name), { recursive: true });
            } catch (e: any) {
                console.error(e, e?.stack);
            } */
            await copyFolderIObitPerFileMode(path.join(folder, item.name), path.join(destination, path.basename(folder)));
        }
    }
    if (listOfFilesToCopy.length === 0)
        return;
    const chunkSize = 50;
    for (let i = 0; i < listOfFilesToCopy.length; i += chunkSize) {
        // console.log(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Copy "${listOfFilesToCopy.slice(i, Math.min(i + chunkSize, listOfFilesToCopy.length)).join('","')}" "${destination}"`);
        await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Copy "${listOfFilesToCopy
            .slice(i, Math.min(i + chunkSize, listOfFilesToCopy.length))
            .join('","')}" "${path.join(destination, path.basename(folder))}"`);
    }
}
/**
 * Generates a super unique ID.
 *
 * @returns {`${number}_${number}_${number}`} The super unique ID.
 *
 * @author 8Crafter
 *
 * @remarks Note: This function is from 8Crafter's Server Utilities & Debug Sticks add-on for Minecraft Bedrock Edition.
 */
export function getSuperUniqueID() {
    return `${Date.now()}_${Math.round(Math.random() * 100000)}_${Math.round(Math.random() * 100000)}`;
}
/**
 * The path to the temp folder of the app data folder for 8Crafter's Ore UI Customizer.
 */
export const oreUICustomizerAppDataTempPath = path.join(userFolderPath, "AppData", "Roaming", "8Crafter's Ore UI Customizer", "temp");
/**
 * Checks if a folder only has nested empty folders.
 *
 * @param {string} folder The folder to check.
 * @returns {boolean} `true` if the folder only has nested empty folders, `false` otherwise.
 */
export function checkFolderOnlyHasNestedEmptyFolders(folder) {
    const folderContents = readdirSync(folder, { withFileTypes: true });
    return (folderContents.length === 0 || folderContents.every((item) => item.isDirectory() && checkFolderOnlyHasNestedEmptyFolders(path.join(folder, item.name))));
}
/**
 * Copies a folder using IObit Unlocker per folder.
 *
 * @param {string} folder The folder to copy.
 * @param {string} destination The destination folder.
 * @returns {Promise<void>} A promise that resolves when the folder is copied.
 */
export async function copyFolderIObitPerFolderMode(folder, destination) {
    const folderContents = readdirSync(folder, { withFileTypes: true });
    // console.log(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Copy "${folder}" "${destination}"\n`);
    if (folderContents.some((item) => item.isFile()) ||
        ((folderContents.length === 0 || checkFolderOnlyHasNestedEmptyFolders(folder)) && !existsSync(path.join(destination, path.basename(folder))))) {
        if (!existsSync(destination)) {
            const tempID = getSuperUniqueID();
            const destinationSegments = destination.split(path.sep);
            for (let i = 0; i < destinationSegments.length; i++) {
                if (existsSync(destinationSegments.slice(0, i + 1).join(path.sep)))
                    continue;
                mkdirSync(path.join(oreUICustomizerAppDataTempPath, "IObitUnlockerFolderCreation", tempID, destinationSegments.slice(i).join(path.sep)), {
                    recursive: true,
                });
                await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Copy "${path.join(oreUICustomizerAppDataTempPath, "IObitUnlockerFolderCreation", tempID, destinationSegments[i])}" "${destinationSegments.slice(0, i).join(path.sep)}"`).then((r) => {
                    if (r.err !== null) {
                        throw r.err;
                    }
                });
                rmSync(path.join(oreUICustomizerAppDataTempPath, "IObitUnlockerFolderCreation", tempID, destinationSegments[i]), {
                    recursive: true,
                    force: true,
                });
                break;
            }
            rmSync(path.join(oreUICustomizerAppDataTempPath, "IObitUnlockerFolderCreation", tempID), { recursive: true, force: true });
        }
        await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Copy "${folder}" "${destination}"`).then((r) => {
            if (r.err !== null) {
                throw r.err;
            }
        });
    }
    for (const item of folderContents.filter((item) => item.isDirectory())) {
        await copyFolderIObitPerFolderMode(path.join(folder, item.name), path.join(destination, path.basename(folder)));
    }
}
/**
 * Get the zip file of the version's GUI folder.
 *
 * @param {string} versionFolder The path to the version folder.
 * @param {typeof accessType} accessMode The access mode.
 * @returns {Promise<Blob>} A promise that resolves with the zip file.
 */
export async function getZip(versionFolder, accessMode) {
    const zipFs = new zip.fs.FS();
    function addFolderContents(directoryEntry, basePath, folder = "") {
        const folderContents = readdirSync(path.join(basePath, folder), { withFileTypes: true });
        for (const item of folderContents) {
            if (item.isFile()) {
                directoryEntry.addBlob(item.name, new Blob([readFileSync(path.resolve(basePath, folder, item.name))]));
            }
            else if (item.isDirectory()) {
                addFolderContents(directoryEntry.addDirectory(item.name), basePath, path.join(folder, item.name));
            }
        }
    }
    /**
     * The path to the vanilla gui backup folder for the provided version folder.
     */
    const vanillaBackupPath = path.join(userFolderPath, "AppData", "Roaming", "8Crafter's Ore UI Customizer", path.basename(versionFolder), "data", "gui_vanilla_backup");
    if (existsSync(vanillaBackupPath)) {
        addFolderContents(zipFs.addDirectory("gui"), vanillaBackupPath);
    }
    else if (existsSync(path.join(versionFolder, "data/gui_vanilla_backup"))) {
        copyFolder(path.join(versionFolder, "data/gui_vanilla_backup"), vanillaBackupPath);
        addFolderContents(zipFs.addDirectory("gui"), vanillaBackupPath);
    }
    else {
        copyFolder(path.join(versionFolder, "data/gui"), vanillaBackupPath);
        addFolderContents(zipFs.addDirectory("gui"), vanillaBackupPath);
    }
    return await zipFs.exportBlob();
}
/**
 * Get the config data for 8Crafter's Ore UI Customizer from the specified version folder.
 *
 * @param {string} versionFolder The path to the version folder.
 * @returns {Promise<OreUICustomizerConfig | undefined>} A promise that resolves with the config data, or `undefined` if the config file is not found.
 */
export async function getCurrentCustomizerConfigurationAndVersion(versionFolder) {
    if (!existsSync(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
        return undefined;
    }
    return readJSCustomizerConfigFile(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"));
}
/**
 * Read a JavaScript config file for 8Crafter's Ore UI Customizer.
 *
 * @param {string} filePath The path to the config file.
 * @returns {Promise<OreUICustomizerConfig>} A promise that resolves with the config data.
 */
export async function readJSCustomizerConfigFile(filePath) {
    const configFile = await import(`data:text/javascript,${encodeURIComponent(readFileSync(filePath, { encoding: "utf-8" }).replaceAll(/(?<=^|\n)const /g, "export const "))}`);
    return configFile;
}
/**
 * Uninstall 8Crafter's Ore UI Customizer from a version.
 *
 * @param {string} versionFolder The path to the version folder of the version to uninstall 8Crafter's Ore UI Customizer from.
 * @returns {Promise<void>} A promise that resolves when the uninstallation is complete.
 */
export async function uninstallOreUICustomizer(versionFolder) {
    /**
     * The path to the vanilla gui backup folder for the provided version folder.
     */
    const vanillaBackupPath = path.join(userFolderPath, "AppData", "Roaming", "8Crafter's Ore UI Customizer", path.basename(versionFolder), "data", "gui_vanilla_backup");
    if (existsSync(vanillaBackupPath)) {
        if (accessType === "BedrockLauncher") {
            rmSync(path.join(versionFolder, "data/gui"), { recursive: true, force: true });
            copyFolder(vanillaBackupPath, path.join(versionFolder, "data/gui"));
            rmSync(path.join(versionFolder, "data/gui_vanilla_backup"), { recursive: true, force: true });
        }
        else if (accessType === "IObit Unlocker") {
            await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Delete "${path.join(versionFolder, "data/gui")}"`);
            await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Delete "${path.join(versionFolder, "data/gui_vanilla_backup")}"`);
            await copyFolderIObitPerFolderMode(vanillaBackupPath, path.join(versionFolder, "data"));
            await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Rename "${path.join(versionFolder, "data/gui_vanilla_backup")}" "gui"`).then((r) => {
                if (r.err !== null) {
                    throw r.err;
                }
            });
        }
        rmSync(vanillaBackupPath, { recursive: true, force: true });
        rmSync(path.join(vanillaBackupPath, "../gui"), { recursive: true, force: true });
    }
    else if (existsSync(path.join(versionFolder, "data/gui_vanilla_backup"))) {
        if (accessType === "BedrockLauncher") {
            rmSync(path.join(versionFolder, "data/gui"), { recursive: true, force: true });
            copyFolder(path.join(versionFolder, "data/gui_vanilla_backup"), path.join(versionFolder, "data/gui"));
            rmSync(path.join(versionFolder, "data/gui_vanilla_backup"), { recursive: true, force: true });
        }
        else if (accessType === "IObit Unlocker") {
            await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Delete "${path.join(versionFolder, "data/gui")}"`);
            await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Rename "${path.join(versionFolder, "data/gui_vanilla_backup")}" "gui"`).then((r) => {
                if (r.err !== null) {
                    throw r.err;
                }
            });
        }
        rmSync(vanillaBackupPath, { recursive: true, force: true });
        rmSync(path.join(vanillaBackupPath, "../gui"), { recursive: true, force: true });
    }
    else {
        if (existsSync(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
            throw new ReferenceError('Cannot uninstall Ore UI Customizer, no backup folder found, Ore UI Customizer is installed on this version but the backup folder was deleted or was never created, if there is a backup folder, please rename it to "gui_vanilla_backup".');
        }
        throw new ReferenceError("Cannot uninstall Ore UI Customizer, Ore UI Customizer is not installed.");
    }
}
/**
 * Apply a modded zip to a version.
 *
 * @param {Blob} moddedZip The modded zip to apply.
 * @param {string} versionFolder The path to the version folder of the version to apply the modded zip to.
 * @returns {Promise<void>} A promise that resolves when the modded zip is applied.
 */
export async function applyModdedZip(moddedZip, versionFolder) {
    /**
     * The zip file system.
     */
    const zipFs = new zip.fs.FS();
    await zipFs.importBlob(moddedZip);
    /**
     * Recursively add the contents of the zip folder to a destination folder.
     *
     * @param {zip.ZipDirectoryEntry} directoryEntry The zip directory entry to extract the contents from.
     * @param {string} basePath The base path to extract the contents to.
     * @param {string} destinationFolder The subfolder of the zip and base path to extract the contents from and to respectively.
     * @returns {Promise<void>} A promise that resolves when the contents are extracted.
     */
    async function addFolderContentsReversed(directoryEntry, basePath, destinationFolder = "") {
        const folderContents = directoryEntry.children;
        for (const item of folderContents) {
            try {
                mkdirSync(path.resolve(basePath, destinationFolder), { recursive: true });
            }
            catch { }
            if (item instanceof zip.fs.ZipFileEntry) {
                writeFileSync(path.resolve(basePath, destinationFolder, item.name), await (await item.getBlob()).bytes());
            }
            else if (item instanceof zip.fs.ZipDirectoryEntry) {
                await addFolderContentsReversed(item, basePath, path.join(destinationFolder, item.name));
            }
        }
    }
    try {
        if (accessType === "BedrockLauncher") {
            rmSync(path.join(versionFolder, "data/gui"), { recursive: true, force: true });
        }
        else if (accessType === "IObit Unlocker") {
            await runCommmand(`C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Delete "${path.join(versionFolder, "data/gui")}"`);
        }
    }
    catch { }
    if (accessType === "BedrockLauncher") {
        await addFolderContentsReversed(zipFs.getChildByName("gui"), path.join(versionFolder, "data/gui"));
        // /**
        //  * The path to the temp folder to use to apply the zip.
        //  */
        // const tempPath = path.join(userFolderPath, "AppData", "Roaming", "8Crafter's Ore UI Customizer", path.basename(versionFolder), "data", "gui");
        // rmSync(tempPath, { recursive: true, force: true });
        // await addFolderContentsReversed(zipFs.getChildByName("gui") as zip.ZipDirectoryEntry, tempPath);
        // await copyFolderIObitPerFolderMode(tempPath, path.join(versionFolder, "datab"));
    }
    else if (accessType === "IObit Unlocker") {
        /**
         * The path to the temp folder to use to apply the zip.
         */
        const tempPath = path.join(userFolderPath, "AppData", "Roaming", "8Crafter's Ore UI Customizer", path.basename(versionFolder), "data", "gui");
        rmSync(tempPath, { recursive: true, force: true });
        await addFolderContentsReversed(zipFs.getChildByName("gui"), tempPath);
        await copyFolderIObitPerFolderMode(tempPath, path.join(versionFolder, "data"));
        /* if (fileByFileMode) {
        } else {
            await runCommmand(
                `C:/"Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe" /Copy "${tempPath}" "${path.join(versionFolder, "data")}"`
            );
        } */
    }
}
/**
 * Checks if a process is running.
 *
 * @param {string} query The name of the executable for the process.
 * @returns {Promise<boolean>} A promise that resolves with `true` if the process is running, `false` otherwise.
 */
export async function checkIfProcessIsRunning(query) {
    return new Promise((resolve) => {
        exec("tasklist", (_err, stdout, _stderr) => {
            resolve(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
        });
    });
}
/**
 * Runs a command.
 *
 * @param {string} command The command to run.
 * @returns A promise that resolves with the results of the command.
 */
export async function runCommmand(command) {
    return new Promise((resolve) => {
        exec(command, (err, stdout, stderr) => {
            resolve({ err, stdout, stderr });
        });
    });
}
/**
 * Changes the hue of a color.
 *
 * @param {string} rgb The hex color code to change the hue of.
 * @param {number} degree The degree to change the hue by.
 * @returns {string} The new hex color code with the hue shift applied.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export function changeHue(rgb, degree) {
    var hsl = rgbToHSL(rgb);
    hsl.h += degree;
    if (hsl.h > 360) {
        hsl.h -= 360;
    }
    else if (hsl.h < 0) {
        hsl.h += 360;
    }
    return hslToRGB(hsl);
}
/**
 * Converts a hex color code to HSL.
 *
 * @param {string} rgb The hex color code to convert to HSL.
 * @returns {{ h: number; s: number; l: number; }} The HSL values of the color.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export function rgbToHSL(rgb) {
    // strip the leading # if it's there
    rgb = rgb.replace(/^\s*#|\s*$/g, "");
    // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
    if (rgb.length == 3) {
        rgb = rgb.replace(/(.)/g, "$1$1");
    }
    var r = parseInt(rgb.substr(0, 2), 16) / 255, g = parseInt(rgb.substr(2, 2), 16) / 255, b = parseInt(rgb.substr(4, 2), 16) / 255, cMax = Math.max(r, g, b), cMin = Math.min(r, g, b), delta = cMax - cMin, l = (cMax + cMin) / 2, h = 0, s = 0;
    if (delta == 0) {
        h = 0;
    }
    else if (cMax == r) {
        h = 60 * (((g - b) / delta) % 6);
    }
    else if (cMax == g) {
        h = 60 * ((b - r) / delta + 2);
    }
    else {
        h = 60 * ((r - g) / delta + 4);
    }
    if (delta == 0) {
        s = 0;
    }
    else {
        s = delta / (1 - Math.abs(2 * l - 1));
    }
    return {
        h: h,
        s: s,
        l: l,
    };
}
/**
 * Converts HSL values to a hex color code.
 *
 * @param {{ h: number; s: number; l: number }} hsl The HSL values.
 * @returns {string} The RGB hex code.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export function hslToRGB(hsl) {
    var h = hsl.h, s = hsl.s, l = hsl.l, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2, r, g, b;
    if (h < 60) {
        r = c;
        g = x;
        b = 0;
    }
    else if (h < 120) {
        r = x;
        g = c;
        b = 0;
    }
    else if (h < 180) {
        r = 0;
        g = c;
        b = x;
    }
    else if (h < 240) {
        r = 0;
        g = x;
        b = c;
    }
    else if (h < 300) {
        r = x;
        g = 0;
        b = c;
    }
    else {
        r = c;
        g = 0;
        b = x;
    }
    r = normalize_rgb_value(r, m);
    g = normalize_rgb_value(g, m);
    b = normalize_rgb_value(b, m);
    return rgbToHex(r, g, b);
}
/**
 * Normalizes a color value.
 *
 * @param {number} color The color value to normalize.
 * @param {number} m UNDOCUMENTED
 * @returns {number} The normalized color value.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export function normalize_rgb_value(color, m) {
    color = Math.floor((color + m) * 255);
    if (color < 0) {
        color = 0;
    }
    return color;
}
/**
 * Converts RGB values to a hex color code.
 *
 * @param {number} r The red value of the color.
 * @param {number} g The green value of the color.
 * @param {number} b The blue value of the color.
 * @returns {string} The hex color code.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
/**
 * Converts a hex color code to RGB.
 *
 * @param {string} hex The hex color code to convert to RGB.
 * @returns {{ r: number; g: number; b: number; } | null} The RGB values of the color, or null if the color is invalid.
 *
 * @author 8Crafter
 */
export function hexToRGB(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}
/**
 * A class for creating RGB loading bars.
 */
export class RGBLoadingBar {
    /**
     * Whether the loading bar is active or not.
     */
    #loadingBarActive = false;
    /**
     * Whether the loading bar should be stopped or not.
     */
    #stopLoadingBar = false;
    /**
     * Whether the loading bar is active or not.
     */
    get loadingBarActive() {
        return this.#loadingBarActive;
    }
    /**
     * Whether the loading bar is in the process of stopping or not.
     */
    get loadingBarIsStopping() {
        return this.#stopLoadingBar;
    }
    /**
     * Creates an instance of RGBLoadingBar.
     */
    constructor() { }
    /**
     * Starts the loading bar.
     *
     * @returns {Promise<void>} A promise that resolves when the loading bar is stopped.
     *
     * @throws {Error} If the loading bar is already active.
     */
    async startLoadingBar() {
        if (this.#loadingBarActive) {
            throw new Error("Loading bar is already active.");
        }
        /**
         * The width of the loading bar.
         *
         * This is how many characters the bar consists of.
         */
        const barWidth = 40;
        /**
         * The hue span of the loading bar.
         *
         * This is how much the hue changes from the left side of the bar to the right side.
         */
        const hueSpan = 60;
        /**
         * The hue step of the loading bar.
         *
         * This is how much the hue is shifted each frame.
         */
        const hueStep = 5;
        /**
         * The FPS of the loading bar animation.
         *
         * This is how many times per second the loading bar is updated, setting this too high may result in the loading bar having a buggy appearance.
         */
        const barAnimationFPS = 10;
        this.#loadingBarActive = true;
        let i = 0;
        process.stdout.write("\n");
        // let c = { r: 0, g: 255, b: 0 };
        while (!this.#stopLoadingBar) {
            i = (i + hueStep) % 360;
            if (i < 0) {
                i += 360;
            }
            // c = hexToRGB(changeHue(rgbToHex(0, 255, 0), i))!;
            // const selectedColor = "rgb"[Math.floor(Math.random()*3)]! as "r" | "g" | "b";
            // c[selectedColor] = Math.floor(Math.random()*80);
            let str = "";
            for (let j = 0; j < barWidth; j++) {
                // const charColor = [Math.floor(Math.abs(c.r - 40)/40*255), Math.floor(Math.abs(c.g - 40)/40*255), Math.floor(Math.abs(c.b - 40)/40*255)] as const;
                // let colorValue: number = Math.max(Math.min(Math.floor((1 - /* Math.sqrt */ Math.abs(j - Math.abs(i - 40)) / 20) * 255), 255), 0);
                // isNaN(colorValue) && (colorValue = 0);
                // const charColor = [0, colorValue, 0] as const;
                const c = hexToRGB(changeHue(rgbToHex(0, 255, 0), Math.abs(Math.floor((360 - i + (j / barWidth) * hueSpan) % 360))));
                const charColor = [c.r, c.g, c.b];
                str += `\x1b[38;2;${charColor[0]};${charColor[1]};${charColor[2]}m█`;
            }
            process.stdout.moveCursor(0, -1);
            process.stdout.clearLine(1);
            process.stdout.write(str + "\x1b[0m\r\n");
            process.stdout.moveCursor(0, 1);
            await new Promise((resolve) => setTimeout(resolve, 1000 / barAnimationFPS));
        }
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);
        this.#loadingBarActive = false;
    }
    /**
     * Stops the loading bar.
     *
     * @returns {Promise<void>} A promise that resolves when the loading bar is stopped.
     */
    async stopLoadingBar() {
        this.#stopLoadingBar = true;
        while (this.#loadingBarActive) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        this.#stopLoadingBar = false;
    }
    /**
     * Waits until the loading bar is started.
     */
    async waitUntilLoadingBarIsStarted() {
        while (!this.#loadingBarActive) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
}
switch (mode) {
    case "install": {
        if (accessType === "IObit Unlocker" && !existsSync("C:/Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe")) {
            throw new ReferenceError("Cannot use IObit Unlocker, IObit Unlocker is not installed. You must have either Bedrock Launcher or IObit Unlocker installed to use this CLI.");
        }
        const oreUICustomizerAppDataPath = path.join(userFolderPath, "AppData", "Roaming", "8Crafter's Ore UI Customizer");
        try {
            mkdirSync(path.join(oreUICustomizerAppDataPath, path.basename(versionFolder)), { recursive: true });
        }
        catch (e) { }
        try {
            writeFileSync(path.join(oreUICustomizerAppDataPath, path.basename(versionFolder), "lastOreUICustomizerVersionUsed.json"), JSON.stringify({
                customizerVersion: oreUICustomizerAPI.format_version,
                cliVersion: format_version,
            }, null, 4));
        }
        catch (e) { }
        try {
            writeFileSync(path.join(oreUICustomizerAppDataPath, "VERSION.TXT"), format_version);
        }
        catch (e) { }
        /**
         * The loading bar instance.
         */
        const loadingBar = new RGBLoadingBar();
        console.log(chalk.bgBlack(chalk.rgb(255, 0, 175)("Generating zip, this may take a while.")));
        loadingBar.startLoadingBar();
        await loadingBar.waitUntilLoadingBarIsStarted();
        /**
         * The zip folder blob with the original GUI folder.
         */
        const originalZipData = /* new Blob([readFileSync(path.join(versionFolder, "data/gui_mc-v1.21.90_PC.zip"))]) */ await getZip(versionFolder, accessType);
        await loadingBar.stopLoadingBar();
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);
        console.log(chalk.bgBlack(chalk.rgb(255, 0, 175)("Applying mods, this may take a while.")));
        loadingBar.startLoadingBar();
        await loadingBar.waitUntilLoadingBarIsStarted();
        /**
         * The zip folder blob with the modded GUI folder.
         */
        const moddedZipData = await oreUICustomizerAPI.applyMods(originalZipData, {
            baseURI: sourceWebsite,
            enableDebugLogging,
            nodeFS: undefined,
            settings: configData,
        });
        await loadingBar.stopLoadingBar();
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);
        console.log(chalk.bgBlack(chalk.rgb(255, 0, 175)("Applying modded zip, this may take a while.")));
        loadingBar.startLoadingBar();
        await loadingBar.waitUntilLoadingBarIsStarted();
        await applyModdedZip(moddedZipData.zip, versionFolder);
        await loadingBar.stopLoadingBar();
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);
        console.log(chalk.greenBright("Ore UI Customizer installed successfully."));
        if (enableDebugLogging) {
            console.log(`Installed in the following folder: ${versionFolder}`);
        }
        if (Object.keys(moddedZipData.allFailedReplaces).length > 0) {
            console.log(chalk.yellow(`Some customizations failed, this could be due to the provided file being modified, or that version is not supported for the failed customizations: ${JSON.stringify(moddedZipData.allFailedReplaces, null, 4)}`));
        }
        break;
    }
    case "uninstall": {
        if (accessType === "IObit Unlocker" && !existsSync("C:/Program Files (x86)/IObit/IObit Unlocker/IObitUnlocker.exe")) {
            throw new ReferenceError("Cannot use IObit Unlocker, IObit Unlocker is not installed. You must have either Bedrock Launcher or IObit Unlocker installed to use this CLI.");
        }
        uninstallOreUICustomizer(versionFolder);
        console.log("Ore UI Customizer uninstalled successfully.");
        if (enableDebugLogging) {
            console.log(`Uninstalled from the following folder: ${versionFolder}`);
        }
        break;
    }
    case "exportConfig": {
        const exportLocation = prompt("Please enter the path to export the config to: ");
        writeFileSync(exportLocation, CommentJSON.stringify({ oreUICustomizerConfig: configData, oreUICustomizerVersion: configDataVersion }, null, 4));
        break;
    }
}
