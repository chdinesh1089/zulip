const recorderInjectedProp = "__$$recorder_injected__";
if (!window[recorderInjectedProp]) {
    Object.defineProperty(window, recorderInjectedProp, {value: true, writable: false});

    const port = chrome.runtime.connect(chrome.runtime.id);
    port.onMessage.addListener((msg) => window.postMessage(msg, "*"));
    window.addEventListener("message", (event) => {
        console.log(JSON.stringify(event.data));
        // Relay client messages
        if (event.source === window && event.data.type) {
            port.postMessage(event.data);
        }

        if (event.data.type === "PLAYBACK_COMPLETE") {
            port.postMessage({type: "REC_STOP"}, "*");
        }

        if (event.data.downloadComplete) {
            document.querySelector("html").classList.add("__download_complete__");
        }

        if (event.data.oldTitle) {
            document.querySelector('html').classList.add('__recorder_started__');
            if (document.title === "PuppeteerRecording") {
                document.title = event.data.oldTitle;
            }
        }
    });

    window.addEventListener("load", () => {
        // The document.title set there must be in sync with
        // --auto-select-desktop-capture-source=PuppeteerRecording
        // we pass to puppeteer.lauch arg options.
        console.log('Starting the record...');
        const oldTitle = document.title;
        document.title = "PuppeteerRecording";
        window.postMessage({type: "REC_CLIENT_PLAY", data: {oldTitle}}, "*");
    });
}
