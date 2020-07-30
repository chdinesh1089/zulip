const path = require("path");
const {pathToFileURL} = require("url");

const puppeteer = require("puppeteer");
const Xvfb = require("xvfb");

const fs = require("fs").promises;

const width = 1280;
const height = 720;
const xvfb = new Xvfb({silent: true, xvfb_args: ["-screen", "0", `${width}x${height}x24`, "-ac"]});
const options = {
    headless: false,
    args: [
        "--enable-usermedia-screen-capturing",
        "--allow-http-screen-capture",
        "--auto-select-desktop-capture-source=PuppeteerRecording",
        "--load-extension=" + __dirname,
        "--disable-extensions-except=" + __dirname,
        `--window-size=${width},${height}`,
    ],
};

let page;
async function start() {
    // xvfb.startSync()
    let url = process.argv[2];
    let exportname = process.argv[3];
    if (!url) {
        url = "https://zulip.com";
    }
    if (!exportname) {
        exportname = "spinner.webm";
    }
    const browser = await puppeteer.launch(options);
    const pages = await browser.pages();
    page = pages[0];
    await page._client.send("Emulation.clearDeviceMetricsOverride");
    await page._client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: "D:\\puppetcam",
    });
    await page.goto(url, {waitUntil: "networkidle2"});
    await page.setBypassCSP(true);

    // Perform any actions that have to be captured in the exported video
    await page.waitFor(3000);
}

async function stop(filename) {
    await page.evaluate((filename) => {
        window.postMessage({type: "SET_EXPORT_PATH", filename}, "*");
        window.postMessage({type: "REC_STOP"}, "*");
    }, filename);

    // Wait for download of webm to complete
    console.log("Waiting for download..");
    await page.waitForSelector("html.__download_complete__", {timeout: 0});
    console.log("Done");
    // await browser.close()
    // xvfb.stopSync()
}

async function main() {
    await start();
    await stop("test.webm");
}

main();
