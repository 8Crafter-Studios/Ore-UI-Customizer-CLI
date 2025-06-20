import { copyFileSync, existsSync, mkdirSync, read, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import promptSync from "prompt-sync";
import chalk from "chalk";
import semver from "semver";
import "./zip.js";
import { exec } from "child_process";
import * as CommentJSON from "comment-json";
import progress from "progress";
/**
 * The version of the script.
 */
export const format_version = "1.1.2";
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
 * Whether debug logging is enabled.
 */
const enableDebugLogging = flagsArgs.some((arg) => arg.toLowerCase() === "--debug");
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
    const baseURL = "https://www.8crafter.com/api/dependency_lists/";
    const dependenciesData = (await (await fetch(new URL("ore-ui-customizer-api.dependencies.json", baseURL).href)).json());
    let scriptData = /* readFileSync(
        path.join(import.meta.dirname, "./ore-ui-customizer-api.js")
    ).toString(); */ await (await fetch(new URL(dependenciesData.main_script.js, baseURL).href)).text();
    for (const dependency of dependenciesData.dependencies) {
        const dependencyScriptData = await (await fetch(new URL(dependency.js, baseURL).href)).text();
        const dependencyScriptDataURI = `data:text/javascript;base64,${Buffer.from(dependencyScriptData).toString("base64")}`;
        scriptData = scriptData.replaceAll(dependency.currentImportStatementText, dependencyScriptDataURI);
    }
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
const oreUICustomizerAPI = await import(await getOreUICustomizerAPIDataURI(), { with: {} });
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
const userFolderPath = import.meta.dirname.split(path.sep).slice(0, 3).join(path.sep);
// Check if the user folder path is valid.
if (!new RegExp(`[A-Z]:${path.sep === "\\" ? "\\\\" : path.sep}Users${path.sep === "\\" ? "\\\\" : path.sep}`).test(userFolderPath)) {
    console.error(`Invalid user folder path, please make sure this package is installed globally: "${userFolderPath}"`);
    process.exit(1);
}
/**
 * The path to the Bedrock Launcher data folder.
 */
const mcBedrockFolderPath = path.join(userFolderPath, "AppData/Roaming/.minecraft_bedrock");
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
        configData = data;
        configDataVersion = data.format_version;
    }
    else if (path.extname(configPath) === ".js") {
        const data = await readJSCustomizerConfigFile(configPath);
        configData = data?.oreUICustomizerConfig;
        configDataVersion = data?.oreUICustomizerVersion;
    }
    else {
        throw new TypeError("Config file must be a JSON or JavaScript file.");
    }
}
try {
    /**
     * The path to the Bedrock Launcher versions folder.
     */
    const mcBedrockVersionsFolderPath = path.join(mcBedrockFolderPath, "versions");
    /**
     * The list of folders for all the currently installed Minecraft Bedrock Edition versions.
     */
    const bedrockLauncherVersionFolders = readdirSync(mcBedrockVersionsFolderPath).filter((versionFolder) => versionFolder.split("-").length === 5); /*
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
            if (!AppxManifestXMLVersion) {
                return "Unable to determine version.";
            }
            const AppxManifestXMLEdition = AppxManifestXMLContent.match(/\<DisplayName\>(Minecraft for Windows|Minecraft Windows Preview)\<\/DisplayName>/)?.[1];
            const versionSegments = AppxManifestXMLVersion.split(".");
            return `${Number(versionSegments[0])}.${Number(versionSegments[1])}.${Number(versionSegments[2]?.slice(0, -2))}.${Number(versionSegments[2]?.slice(-2))} (${AppxManifestXMLEdition === "Minecraft for Windows" ? "Release" : "Preview"})`;
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
                    : semver.eq(a
                        .slice(0, -a.indexOf(" ("))
                        .trim()
                        .replace(/\.(?=\d+$)/, "-"), b
                        .slice(0, -b.indexOf(" ("))
                        .trim()
                        .replace(/\.(?=\d+$)/, "-"))
                        ? 0
                        : semver.gt(b
                            .slice(0, -b.indexOf(" ("))
                            .trim()
                            .replace(/\.(?=\d+$)/, "-"), a
                            .slice(0, -a.indexOf(" ("))
                            .trim()
                            .replace(/\.(?=\d+$)/, "-"))
                            ? 1
                            : -1);
        /**
         * Sort the {@link bedrockLauncherVersionFolders} array from highest to smallest version number.
         */
        for (const [v, i] of versionNumbers.map((v, i) => [v, i])) {
            bedrockLauncherVersionFolders[i] = versionNumberToFolderMap.get(v);
        }
        /**
         * Prompt the user to select a Minecraft version.
         */
        let folderSelection = prompt({
            ask: `${chalk.yellowBright(`Multiple Minecraft versions were found, please enter the number of the Minecraft version to ${mode === "install"
                ? "install 8Crafter's Ore UI Customizer on"
                : mode === "uninstall"
                    ? "uninstall 8Crafter's Ore UI Customizer from"
                    : "export the config of 8Crafter's Ore UI Customizer from"}:`)}\n${versionNumbers.map((v, i) => `${i + 1}: ${v}`).join("\n")}\nSelection: `,
        });
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
                            ...bedrockLauncherVersionFolders.filter((versionFolder) => !versionFolderToNumberMap.get(versionFolder)?.endsWith(selectionReleaseStage === "Preview" ? "Release" : "Preview")),
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
        console.error("No Minecraft Bedrock versions found.");
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
function copyFolder(folder, destination) {
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
                mkdirSync(path.join(destination, item.name));
            }
            catch (e) {
                console.error(e, e?.stack);
            }
            copyFolder(path.join(folder, item.name), path.join(destination, item.name));
        }
    }
}
async function getZip(versionFolder) {
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
    if (existsSync(path.join(versionFolder, "data/gui_vanilla_backup"))) {
        addFolderContents(zipFs.addDirectory("gui"), path.join(versionFolder, "data/gui_vanilla_backup"));
    }
    else {
        copyFolder(path.join(versionFolder, "data/gui"), path.join(versionFolder, "data/gui_vanilla_backup"));
        addFolderContents(zipFs.addDirectory("gui"), path.join(versionFolder, "data/gui"));
    }
    return await zipFs.exportBlob();
}
async function getCurrentCustomizerConfigurationAndVersion(versionFolder) {
    if (!existsSync(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
        return undefined;
    }
    return readJSCustomizerConfigFile(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"));
}
async function readJSCustomizerConfigFile(filePath) {
    const configFile = await import(`data:text/javascript,${encodeURIComponent(readFileSync(filePath, { encoding: "utf-8" }).replaceAll(/(?<=^|\n)const /g, "export const "))}`);
    return configFile;
}
function uninstallOreUICustomizer(versionFolder) {
    if (existsSync(path.join(versionFolder, "data/gui_vanilla_backup"))) {
        rmSync(path.join(versionFolder, "data/gui"), { recursive: true, force: true });
        copyFolder(path.join(versionFolder, "data/gui_vanilla_backup"), path.join(versionFolder, "data/gui"));
        rmSync(path.join(versionFolder, "data/gui_vanilla_backup"), { recursive: true, force: true });
    }
    else {
        if (existsSync(path.join(versionFolder, "data/gui/dist/hbui/oreUICustomizer8CrafterConfig.js"))) {
            throw new ReferenceError('Cannot uninstall Ore UI Customizer, no backup folder found, Ore UI Customizer is installed on this version but the backup folder was deleted or was never created, if there is a backup folder, please rename it to "gui_vanilla_backup".');
        }
        throw new ReferenceError("Cannot uninstall Ore UI Customizer, Ore UI Customizer is not installed.");
    }
}
async function applyModdedZip(moddedZip, versionFolder) {
    const zipFs = new zip.fs.FS();
    await zipFs.importBlob(moddedZip);
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
                addFolderContentsReversed(item, basePath, path.join(destinationFolder, item.name));
            }
        }
    }
    try {
        rmSync(path.join(versionFolder, "data/gui"), { recursive: true, force: true });
    }
    catch { }
    await addFolderContentsReversed(zipFs.getChildByName("gui"), path.join(versionFolder, "data/gui"));
}
async function checkIfProcessIsRunning(query) {
    return new Promise((resolve) => {
        let platform = process.platform;
        let cmd = "";
        switch (platform) {
            case "win32":
                cmd = `tasklist`;
                break;
            case "darwin":
                cmd = `ps -ax | grep ${query}`;
                break;
            case "linux":
                cmd = `ps -A`;
                break;
            default:
                break;
        }
        exec(cmd, (err, stdout, stderr) => {
            resolve(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
        });
    });
}
/**
 *
 * @param rgb
 * @param degree
 * @returns
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
function changeHue(rgb, degree) {
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
 *
 * @param rgb
 * @returns
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
function rgbToHSL(rgb) {
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
 *
 * @param hsl
 * @returns
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
function hslToRGB(hsl) {
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
 *
 * @param color
 * @param m
 * @returns
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
function normalize_rgb_value(color, m) {
    color = Math.floor((color + m) * 255);
    if (color < 0) {
        color = 0;
    }
    return color;
}
/**
 *
 * @param r
 * @param g
 * @param b
 * @returns
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function hexToRGB(hex) {
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
        /**
         * The loading bar instance.
         */
        const loadingBar = new RGBLoadingBar();
        /**
         * The zip folder blob with the original GUI folder.
         */
        const originalZipData = /* new Blob([readFileSync(path.join(versionFolder, "data/gui_mc-v1.21.90_PC.zip"))]) */ await getZip(versionFolder);
        console.log(chalk.bgBlack(chalk.rgb(255, 0, 175)("Applying mods, this may take a while.")));
        loadingBar.startLoadingBar();
        await loadingBar.waitUntilLoadingBarIsStarted();
        /**
         * The zip folder blob with the modded GUI folder.
         */
        const moddedZipData = await oreUICustomizerAPI.applyMods(originalZipData, {
            baseURI: "https://www.8crafter.com/",
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
        uninstallOreUICustomizer(versionFolder);
        console.log("Ore UI Customizer uninstalled successfully.");
        if (enableDebugLogging) {
            console.log(`Uninstalled from the following folder: ${versionFolder}`);
        }
        break;
    }
    case "exportConfig": {
        const exportLocation = prompt("Please enter the path to export the config to: ");
        writeFileSync(exportLocation, CommentJSON.stringify({ ...configData, format_version: configDataVersion }, null, 4));
        break;
    }
}
