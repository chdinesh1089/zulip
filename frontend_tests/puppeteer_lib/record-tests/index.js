// const puppeteer = require("puppeteer");
const Xvfb = require("xvfb");
const width = 1280;
const height = 720;

const xvfb = new Xvfb({silent: true, xvfb_args: ["-screen", "0", `${width}x${height}x24`, "-ac"],});
xvfb.startSync()

const fs = require("fs").promises;
const path = require("path");

const launchArgsOptions = [
    "--enable-usermedia-screen-capturing",
    "--allow-http-screen-capture",
    "--auto-select-desktop-capture-source=PuppeteerRecording",
    "--load-extension=" + __dirname,
    "--disable-extensions-except=" + __dirname,
    `--window-size=${width},${height}`,
];

async function start(page) {
    await page._client.send("Emulation.clearDeviceMetricsOverride");
    await page.setBypassCSP(true);
}

async function stop(page, { filename = null, saveDirectory } = {}) {
    if (saveDirectory) {
      await page._client.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: saveDirectory,
      });
    }

    await page.evaluate((filename) => {
        window.postMessage({type: "SET_EXPORT_PATH", filename}, "*");
        window.postMessage({type: "REC_STOP"}, "*");
    }, filename);

    console.log('Waiting for recording...');
    await page.waitForSelector("html.__download_complete__", {timeout: 0});
    xvfb.stopSync();
}

module.exports = {
  launchArgsOptions,
  start,
  stop,
};