import "./zip.js";
/**
 * The version of the script.
 */
export declare const format_version: "1.1.2";
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
