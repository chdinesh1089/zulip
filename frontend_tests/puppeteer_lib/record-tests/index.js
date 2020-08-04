const path = require('path');
const fs = require('fs').promises;

const Xvfb = require("xvfb");

const width = 1280;
const height = 720;

const xvfb = new Xvfb({silent: true, xvfb_args: ["-screen", "0", `${width}x${height}x24`, "-ac"],});
// xvfb.startSync();


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
    await page.waitForSelector('html.__recorder_started__', { timeout: 0 });
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

    if (filename !== null) {
        await page.waitForSelector("html.__download_complete__", {timeout: 0});
        
        const savePath = path.join(saveDirectory, filename);
        const downloadPath = await page.evaluate(() => {
            const $html = document.querySelector('html');
            return $html.dataset.puppeteerRecordingFilename;
        });

        console.log('Download path: ', downloadPath);
        try {
            // Remve the old recording it exisits!
            await fs.unlink(savePath);
        } catch {}

        await fs.rename(downloadPath, savePath);
    }

    // xvfb.stopSync();
}

module.exports = {
  launchArgsOptions,
  start,
  stop,
};