// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

const { contextBridge, ipcRenderer } = require("electron");




contextBridge.exposeInMainWorld("ipcRenderer", {
    sendSync: (channel, data) => ipcRenderer.sendSync(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data), // async IPC
    on: (channel, listener) => ipcRenderer.on(channel, listener)  // event listener
  })
