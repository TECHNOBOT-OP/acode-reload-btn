import plugin from "../plugin.json";
import styles from "./styles.scss";

const fs = acode.require("fs");
const settings = acode.require("settings");
const toast = acode.require("toast");
const confirm = acode.require("confirm");
let loaded;
let st;
let styl;

class AutoReload {
    constructor() {
        this.isDragging = null;
        this.offsetX = null;
        this.offsetY = null;
        this.isClick = null;
        const arSettings = settings.value[plugin.id];
        if (!arSettings) {
            settings.value[plugin.id] = {
                addRefreshBtn: false,
                autorefreshloadedfiles: false
            };
            settings.update();
        }
    }

    async init() {
        try {
            const { commands } = editorManager.editor;
            commands.addCommand({
                name: "reload-file",
                description: "Reload Current File",
                bindKey: { win: "Ctrl-Shift-R", mac: "Command-Shift-R" },
                exec: this.reload()
            });
            if (settings.value[plugin.id].addRefreshBtn) {
                this.addBtn.bind(this)();
                loaded = true;
            }
            if (settings.value[plugin.id].autorefreshloadedfiles) {
                this.recreload.bind(this)();
            }
        } catch {
            await this.init.bind(this)();
        }
    }

    async destroy() {
        if (loaded) {
            this.remBtn.bind(this)();
        }
        if (st) {
            clearTimeout(st);
        }
        delete settings.value[plugin.id];
        settings.update();
    }

    async reload() {
        const em = editorManager;
        const file = em.activeFile;
        if (!file.loaded) return;
        if (file.isUnsaved) {
            const cn = await confirm(
                "Warning!",
                "The current file is unsaved. Changes may be lost. Do you want to reload?"
            );
            if (!cn) return;
        }
        const content = await fs(file.uri).readFile(file.encoding);
        if (content != file.session.getValue()) {
            file.session.setValue(content);
            file.isUnsaved = false;
            file.markChanged = false;
            toast("Reloaded Successfully!", 1000);
        }
    }

    async recreload() {
        if (!settings.value[plugin.id].autorefreshloadedfiles) return;
        try {
            const em = editorManager;

            for (const e of em.files) {
                if (e == em.activeFile) continue;
                if (!e.loaded) continue;
                if (!e.isUnsaved) continue;
                const content = await fs(e.uri).readFile(e.encoding);
                if (content != e.session.getValue()) {
                    e.session.setValue(content);
                    e.markChanged = false;
                    e.isUnsaved = false;
                    toast(e.filename + "Reloaded.", 200);
                }
            }
            st = setTimeout(this.recreload.bind(this), 10);
        } catch {
            if (!settings.value[plugin.id].autorefreshloadedfiles) return;
            await this.recreload();
        }
    }

    async addBtn() {
        styl = <style textContent={styles}></style>;
        const root = document.getElementById("root");
        if (!root) {
            setTimeout(this.addBtn.bind(this), 1000);
            return;
        }
        this.btn = tag("span", {
            className: "reloadBtn icon refresh",
            id: "reload-btn"
        });
        const top = localStorage.getItem("btnTop") || 0;
        const left = localStorage.getItem("btnLeft") || "calc(100vw - 60px)";
        this.btn.style.top = top;
        this.btn.style.left = left;
        if(localStorage.getItem("sticked") === "true"){
            this.btn.classList.add("stick");
            this.btn.innerText = "Refresh";
        }
        this.btn.addEventListener("touchstart", this.onTouchStart.bind(this));
        this.btn.addEventListener("touchmove", this.touchMove.bind(this));
        this.btn.addEventListener("touchend", this.touchStop.bind(this));
        root.appendChild(this.btn);
        document.head.appendChild(styl);
    }

    remBtn() {
        if (!loaded) return;
        const root = document.getElementById("root");
        if (!root) {
            setTimeout(this.remBtn.bind(this), 1000);
            return;
        }
        root.removeChild(this.btn);
        document.head.removeChild(styl);
        loaded = false;
    }

    onTouchStart(e) {
        this.isDragging = true;
        this.isClick = true;
        const touch = e.touches[0];
        this.offsetX = touch.clientX - this.btn.getBoundingClientRect().left;
        this.offsetY = touch.clientY - this.btn.getBoundingClientRect().top;
    }

    touchMove(e) {
        this.isClick = false;
        if (!this.isDragging) return;
        const touch = e.touches[0];
        let x = touch.clientX - this.offsetX;
        let y = touch.clientY - this.offsetY;

        // Stick to the left edge if near and within the range of 20px
        if (x < 25) {
            x = -this.btn.offsetWidth / 2 + 9;
        }
        else if (x > window.innerWidth - this.btn.offsetWidth - 25) {
            x = window.innerWidth - this.btn.offsetWidth / 2 - 18;
        }

        // Don't go outside the window from the top
        y = Math.max(
            0,
            Math.min(y, window.innerHeight - this.btn.offsetHeight)
        );

        // Change to a capsule when at the edges
        if (
            x === -this.btn.offsetWidth / 2 + 9 ||
            x === window.innerWidth - this.btn.offsetWidth / 2 - 18
        ) {
            this.btn.classList.add("stick");
            this.btn.innerText = "Refresh";
            localStorage.setItem("sticked", "true");
        } else {
            this.btn.classList.remove("stick");
            this.btn.innerText = "";
            localStorage.removeItem("sticked");
        }

        this.btn.style.left = x + "px";
        localStorage.setItem("btnLeft", x + "px");
        this.btn.style.top = y + "px";
        localStorage.setItem("btnTop", y + "px");
    }

    touchStop() {
        if (this.isClick) {
            this.isClick = false;
            this.reload();
        }
        this.isDragging = false;
    }

    get settingsObject() {
        return {
            list: [
                {
                    key: "addRefreshBtn",
                    text: "Add Refresh Button",
                    checkbox: !!settings.value[plugin.id].addRefreshBtn
                },
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
                settings.update();
                if (k == "addRefreshBtn" && v == true) this.addBtn.bind(this)();
                else if (k == "addRefreshBtn") this.remBtn.bind(this)();
                if (k == "autorefreshloadedfiles" && v == true)
                    this.recreload();
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
