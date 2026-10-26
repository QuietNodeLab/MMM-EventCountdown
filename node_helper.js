const NodeHelper = require("node_helper");
const fs = require("node:fs");
const path = require("node:path");

module.exports = NodeHelper.create({
  socketNotificationReceived(notification, payload) {
    if (notification !== "EVENTCOUNTDOWN_LOAD" || !payload || typeof payload.instanceId !== "string") return;
    const instanceId = payload.instanceId;
    const name = path.basename(String(payload.dataFile || "countdowns.json"));
    const candidates = [path.join(global.root_path, "config", name), path.join(__dirname, name)];
    try {
      const found = candidates.find(file => fs.existsSync(file));
      if (!found) throw new Error("can't find " + name + " in the config folder or module folder");
      const data = JSON.parse(fs.readFileSync(found, "utf8"));
      this.sendSocketNotification("EVENTCOUNTDOWN_DATA", {instanceId, data});
    } catch (error) {
      this.sendSocketNotification("EVENTCOUNTDOWN_ERROR", {instanceId, error: "Cannot load " + name + ": " + error.message});
    }
  }
});
