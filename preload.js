"use strict";
const electron = require("electron");
function getCurrentTime() {
  return (/* @__PURE__ */ new Date()).toLocaleString("zh-CN");
}
function formatText(text) {
  return text.toUpperCase();
}
async function fetchData(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("数据获取失败:", error);
    throw error;
  }
}
const myPluginAPI = {
  getCurrentTime,
  formatText,
  fetchData
};
electron.contextBridge.exposeInMainWorld("myPluginAPI", myPluginAPI);
const handlers = {
  hello: {
    onEnter: async (params) => {
      console.log("Hello World 功能被触发");
      console.log("参数:", params);
      if (typeof window !== "undefined" && window.naimo) {
        window.naimo.log.info("插件已加载", { params });
      }
    }
  }
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = handlers;
}
window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload 脚本已初始化");
  console.log("当前时间:", getCurrentTime());
});
