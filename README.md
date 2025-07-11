# 8Crafter's Ore UI Customizer CLI

<!-- ![Thumbnail](./assets/thumbnail.png) -->

[![NPM Downloads](https://img.shields.io/npm/d18m/ore-ui-customizer-cli)](https://npmjs.com/package/ore-ui-customizer-cli)
[![NPM Version](https://img.shields.io/npm/v/ore-ui-customizer-cli)](https://npmjs.com/package/ore-ui-customizer-cli)
[![NPM License](https://img.shields.io/npm/l/ore-ui-customizer-cli)](https://npmjs.com/package/ore-ui-customizer-cli)
[![NPM Last Update](https://img.shields.io/npm/last-update/ore-ui-customizer-cli)](https://npmjs.com/package/ore-ui-customizer-cli)
[![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/ore-ui-customizer-cli)](https://npmjs.com/package/ore-ui-customizer-cli)
[![GitHub last commit](https://img.shields.io/github/last-commit/8Crafter-Studios/ore-ui-customizer-cli)](https://github.com/8Crafter-Studios/ore-ui-customizer-cli/commits/main)
[![Discord](https://img.shields.io/discord/1213197616570048512?logo=discord&label=discord&link=https%3A%2F%2Fdiscord.gg%2F8crafter-studios)](https://discord.gg/8crafter-studios)

This is a CLI to install the latest update of 8Crafter's Ore UI Customizer on your Minecraft Bedrock Edition installation.

https://www.8crafter.com/utilities/ore-ui-customizer

Using this requires that you either use [Bedrock Launcher](https://bedrocklauncher.github.io/), IObit Unlocker (Bedrock Launcher is recommended), or another custom Minecraft Bedrock Edition launcher.

This node module also requires that you use Windows.

This module MUST BE INSTALLED GLOBALLY!

## Installation

```
npm i -g ore-ui-customizer-cli
```

## CLI

```
Usage:

ore-ui-customizer-cli [options]             Install the Ore UI Customizer.

Options:
  --config=<path>                       The path to the configuration file to use, if not specified it will try to find a config from one of your other Minecraft versions if you use bedrock launcher, or if you use IObit Unlocker, it will search the release and preview versions, if no config is found, it will use the default config.
  -r, --uninstall                       Uninstall the Ore UI Customizer.
  -ec, --exportconfig                   Export the configuration file.
  --debug                               Enable debug logging.
  --source-website=<URI>                Makes the CLI use a custom source website instead of https://www.8crafter.com/, this is used for development if you have a locally running instance of the website, then you can use the localhost IP for it.
  --version-folder=<path>               The path to the Minecraft version folder, use this if you use a custom Minecraft Bedrock Edition launcher other than bedrock launcher, the path should be the path to the folder for the Minecraft version you want to install the Ore UI Customizer on, the folder should contain a data folder which contains a gui folder.
```
