import "./zip.js";
import type { OreUICustomizerConfig } from "OreUICustomizerAssets";
import { type ExecException } from "child_process";
/**
 * The version of the script.
 */
export declare const format_version: "1.9.0";
/**
 * API for 8Crafter's Ore UI Customizer.
 *
 * @see {@link https://www.8crafter.com/api/ore-ui-customizer-api.js}
 * @see {@link https://www.8crafter.com/assets/shared/ore-ui-customizer-assets.js}
 * @see {@link https://www.8crafter.com/utilities/ore-ui-customizer}
 */
export declare const oreUICustomizerAPI: typeof import("OreUICustomizerAPI");
/**
 * The path to the user folder.
 *
 * This is the same folder you are sent to if your type `%AppData%/../../` in the `WIN+R` Run dialog.
 */
export declare const userFolderPath: string;
/**
 * The path to the Bedrock Launcher data folder.
 */
export declare const mcBedrockFolderPath: string;
/**
 * The type of Minecraft Bedrock Edition installation to install 8Crafter's Ore UI Customizer on.
 */
declare let accessType: "BedrockLauncher" | "IObit Unlocker";
/**
 * Copies a folder.
 *
 * @param {string} folder The folder to copy.
 * @param {string} destination The destination folder.
 */
export declare function copyFolder(folder: string, destination: string): void;
/**
 * Copies a folder using IObit Unlocker per file.
 *
 * @param {string} folder The folder to copy.
 * @param {string} destination The destination folder.
 * @returns {Promise<void>} A promise that resolves when the folder is copied.
 */
export declare function copyFolderIObitPerFileMode(folder: string, destination: string): Promise<void>;
/**
 * Generates a super unique ID.
 *
 * @returns {`${number}_${number}_${number}`} The super unique ID.
 *
 * @author 8Crafter
 *
 * @remarks Note: This function is from 8Crafter's Server Utilities & Debug Sticks add-on for Minecraft Bedrock Edition.
 */
export declare function getSuperUniqueID(): `${number}_${number}_${number}`;
/**
 * The path to the temp folder of the app data folder for 8Crafter's Ore UI Customizer.
 */
export declare const oreUICustomizerAppDataTempPath: string;
/**
 * Checks if a folder only has nested empty folders.
 *
 * @param {string} folder The folder to check.
 * @returns {boolean} `true` if the folder only has nested empty folders, `false` otherwise.
 */
export declare function checkFolderOnlyHasNestedEmptyFolders(folder: string): boolean;
/**
 * Copies a folder using IObit Unlocker per folder.
 *
 * @param {string} folder The folder to copy.
 * @param {string} destination The destination folder.
 * @returns {Promise<void>} A promise that resolves when the folder is copied.
 */
export declare function copyFolderIObitPerFolderMode(folder: string, destination: string): Promise<void>;
/**
 * Get the zip file of the version's GUI folder.
 *
 * @param {string} versionFolder The path to the version folder.
 * @param {typeof accessType} accessMode The access mode.
 * @returns {Promise<Blob>} A promise that resolves with the zip file.
 */
export declare function getZip(versionFolder: string, accessMode: typeof accessType): Promise<Blob>;
/**
 * Get the config data for 8Crafter's Ore UI Customizer from the specified version folder.
 *
 * @param {string} versionFolder The path to the version folder.
 * @returns {Promise<OreUICustomizerConfig | undefined>} A promise that resolves with the config data, or `undefined` if the config file is not found.
 */
export declare function getCurrentCustomizerConfigurationAndVersion(versionFolder: string): Promise<OreUICustomizerConfig | undefined>;
/**
 * Read a JavaScript config file for 8Crafter's Ore UI Customizer.
 *
 * @param {string} filePath The path to the config file.
 * @returns {Promise<OreUICustomizerConfig>} A promise that resolves with the config data.
 */
export declare function readJSCustomizerConfigFile(filePath: string): Promise<OreUICustomizerConfig>;
/**
 * Uninstall 8Crafter's Ore UI Customizer from a version.
 *
 * @param {string} versionFolder The path to the version folder of the version to uninstall 8Crafter's Ore UI Customizer from.
 * @returns {Promise<void>} A promise that resolves when the uninstallation is complete.
 */
export declare function uninstallOreUICustomizer(versionFolder: string): Promise<void>;
/**
 * Apply a modded zip to a version.
 *
 * @param {Blob} moddedZip The modded zip to apply.
 * @param {string} versionFolder The path to the version folder of the version to apply the modded zip to.
 * @returns {Promise<void>} A promise that resolves when the modded zip is applied.
 */
export declare function applyModdedZip(moddedZip: Blob, versionFolder: string): Promise<void>;
/**
 * Checks if a process is running.
 *
 * @param {string} query The name of the executable for the process.
 * @returns {Promise<boolean>} A promise that resolves with `true` if the process is running, `false` otherwise.
 */
export declare function checkIfProcessIsRunning(query: string): Promise<boolean>;
/**
 * Runs a command.
 *
 * @param {string} command The command to run.
 * @returns A promise that resolves with the results of the command.
 */
export declare function runCommmand(command: string): Promise<{
    err: ExecException | null;
    stdout: string;
    stderr: string;
}>;
/**
 * Changes the hue of a color.
 *
 * @param {string} rgb The hex color code to change the hue of.
 * @param {number} degree The degree to change the hue by.
 * @returns {string} The new hex color code with the hue shift applied.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export declare function changeHue(rgb: string, degree: number): string;
/**
 * Converts a hex color code to HSL.
 *
 * @param {string} rgb The hex color code to convert to HSL.
 * @returns {{ h: number; s: number; l: number; }} The HSL values of the color.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export declare function rgbToHSL(rgb: string): {
    h: number;
    s: number;
    l: number;
};
/**
 * Converts HSL values to a hex color code.
 *
 * @param {{ h: number; s: number; l: number }} hsl The HSL values.
 * @returns {string} The RGB hex code.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export declare function hslToRGB(hsl: {
    h: number;
    s: number;
    l: number;
}): string;
/**
 * Normalizes a color value.
 *
 * @param {number} color The color value to normalize.
 * @param {number} m UNDOCUMENTED
 * @returns {number} The normalized color value.
 *
 * @see https://stackoverflow.com/a/17433060/16872762
 */
export declare function normalize_rgb_value(color: number, m: number): number;
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
export declare function rgbToHex(r: number, g: number, b: number): string;
/**
 * Converts a hex color code to RGB.
 *
 * @param {string} hex The hex color code to convert to RGB.
 * @returns {{ r: number; g: number; b: number; } | null} The RGB values of the color, or null if the color is invalid.
 *
 * @author 8Crafter
 */
export declare function hexToRGB(hex: string): {
    r: number;
    g: number;
    b: number;
} | null;
/**
 * A class for creating RGB loading bars.
 */
export declare class RGBLoadingBar {
    #private;
    /**
     * Whether the loading bar is active or not.
     */
    get loadingBarActive(): boolean;
    /**
     * Whether the loading bar is in the process of stopping or not.
     */
    get loadingBarIsStopping(): boolean;
    /**
     * Creates an instance of RGBLoadingBar.
     */
    constructor();
    /**
     * Starts the loading bar.
     *
     * @returns {Promise<void>} A promise that resolves when the loading bar is stopped.
     *
     * @throws {Error} If the loading bar is already active.
     */
    startLoadingBar(): Promise<void>;
    /**
     * Stops the loading bar.
     *
     * @returns {Promise<void>} A promise that resolves when the loading bar is stopped.
     */
    stopLoadingBar(): Promise<void>;
    /**
     * Waits until the loading bar is started.
     */
    waitUntilLoadingBarIsStarted(): Promise<void>;
}
export {};
