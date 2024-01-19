import plugin from "../plugin.json";

const fs = acode.require("fs");
const settings = acode.require("settings");
const toast = acode.require('toast');
let styl;
let st;
let loaded;
const styles = `
    .reloadBtn {
        border: 1px solid;
        height: 30px;
        width: 30px;
        position: fixed;
        left: calc(100vw - 30px);
        z-index: auto;
        text-align: center;
        box-sizing: border-box;
        border-radius: 10px;
        transition: all .3s ease;
    }

    .reloadBtn:active{
        background: linear-gradient(to right, #a18cd1, #fbc2eb);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .reloadBtn > svg {
        margin: 2px;
        filter: invert(1);
    }
`;

class AutoReload {
    constructor() {
        const arSettings = settings.value[plugin.id];
        if (!arSettings) {
            settings.value[plugin.id] = {
                autorefreshloadedfiles: false
            };
            settings.update();
        }
    }

    async init() {
        try {
            if(!document.querySelector(".reloadBtn")){
                const fl = document.querySelector(".open-file-list");
                if (!fl) {
                    setTimeout(this.init.bind(this), 1000)
                    return;
                }
                const reloadbtn = document.createElement("button");
                reloadbtn.style.backgroundColor =
                    window.getComputedStyle(fl).backgroundColor;
                reloadbtn.className = "reloadBtn";
                reloadbtn.innerHTML =
                    '<svg height="26" viewBox="0 -960 960 960" width="26"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>';
                reloadbtn.addEventListener("click", async e => {
                    e.stopPropagation();
                    const edm = editorManager;
                    const cfile = edm.activeFile;
                    const cval = cfile.session.getValue();
                    const cont = await fs(cfile.uri).readFile(cfile.encoding);
                    if (cont != cval) {
                        cfile.session.setValue(cont);
                        cfile.markChanged = false;
                    }
                    toast("File Reloaded.", 500)
                });
                fl.appendChild(reloadbtn);
                document.querySelector(".reloadBtn>svg").style.fill =
                    window.getComputedStyle(fl).backgroundColor;
                fl.style.width = "calc(100% - 30px)";
            }
            if(!document.head.innerHTML.includes(styles)) {
                styl = document.createElement("style");
                styl.innerText = styles;
                document.head.append(styl);
            }
            loaded = true;
            this.recreload.bind(this)();
        } catch {
            setTimeout(this.init.bind(this), 1000);
        }
    }

    async destroy() {
        if (loaded) {
            const pe = document.querySelector(".open-file-list");
            if (!pe) {
                setTimeout(this.destroy.bind(this), 100);
                return;
            }
            const btn = document.querySelector(".reloadBtn");
            pe.style.removeProperty("width");
            pe.removeChild(btn);
            document.head.removeChild(styl);
            if(st) {
                clearTimeout(st);
            }
        }
        delete settings.value[plugin.id];
        settings.update();
    }

    async recreload() {
        if (!settings.value[plugin.id].autorefreshloadedfiles) return;
        try {
            const em = editorManager;
            
            for (const e of em.files) {
                if (e == em.activeFile) continue;
                if (!e.loaded) continue;
                const content = await fs(e.uri).readFile(e.encoding);
                if (content != e.session.getValue()) {
                    e.session.setValue(content);
                    e.markChanged = false;
                    toast(e.filename + "Reloaded.", 200)
                }
            }
            st = setTimeout(this.recreload.bind(this), 10);
        } catch {
            if (!settings.value[plugin.id].autorefreshloadedfiles) return;
            await this.recreload();
        }
    }

    get settingsObject() {
        return {
            list: [
                {
                    key: "autorefreshloadedfiles",
                    text: "Auto Refresh Loaded Files on change (beta)",
                    checkbox:
                        !!settings.value[plugin.id].autorefreshloadedfiles,
                    info: "If set to true all the loaded files in current editor will be reload automatically when they are changed without closing them or restarting acode. If you face problems turn this off as this feature is experimental!"
                }
            ],
            cb: (k, v) => {
                settings.value[plugin.id][k] = v;
                if (v == true) this.recreload.bind(this)();
            }
        };
    }
}
if (window.acode) {
    const acodePlugin = new AutoReload();
    acode.setPluginInit(
        plugin.id,
        async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
            if (!baseUrl.endsWith("/")) {
                baseUrl += "/";
            }
            acodePlugin.baseUrl = baseUrl;
            await acodePlugin.init();
        },
        acodePlugin.settingsObject
    );
    acode.setPluginUnmount(plugin.id, () => {
        acodePlugin.destroy();
    });
}
