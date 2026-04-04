import fs from "fs-extra";

export const meta = {
  name: "developers",
  aliases: ["owners"],
  version: "2.3.0",
  type: "anyone",
  author: "Converted and Mod by AjiroDesu",
  description: "Manage bot developers / owners",
  category: "config",
  guide: ["list | add/remove/god <userID> or mention"],
  cooldowns: 5
};

export async function onStart({ event, args, Users, permission, response }) {
  const { mentions, senderID } = event;
  const content    = args.slice(1);
  const mentionIDs = Object.keys(mentions || {});

  const { configPath } = global.client;
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!config.ADMINBOT)        config.ADMINBOT        = [];
  if (!global.config.ADMINBOT) global.config.ADMINBOT = [];

  const ADMINBOT    = global.config.ADMINBOT;

  // Master developer — single string ID from DEVELOPER.ID in config
  const masterDevID = String(global.config.DEVELOPER?.ID || "");

  const saveConfig = () => {
    config.ADMINBOT        = [...new Set(ADMINBOT)];
    global.config.ADMINBOT = [...new Set(ADMINBOT)];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
  };

  const showList = async () => {
    const lines = [];
    for (const id of ADMINBOT) {
      const name = await Users.getNameUser(id);
      lines.push(`- ${name} (${id})`);
    }
    return response.reply(
      `[Developers] Developer/owner list:\n\n${lines.join("\n") || "No developers found."}`
    );
  };

  if (!args[0]) return showList();

  switch (args[0]) {
    case "list":
    case "all":
    case "-a":
      return showList();

    // ── Standard add — requires developer permission (level 3) ───────────
    case "add": {
      if (permission < 3) {
        return response.reply('[Developers] You need developer permission to use "add".');
      }

      const added = [];

      if (mentionIDs.length > 0) {
        for (const id of mentionIDs) {
          if (!ADMINBOT.includes(id)) {
            ADMINBOT.push(id);
            const name = await Users.getNameUser(id);
            added.push(`[ ${id} ] » ${name}`);
          }
        }
      } else if (content.length > 0 && !isNaN(content[0])) {
        const id = content[0];
        if (!ADMINBOT.includes(id)) {
          ADMINBOT.push(id);
          const name = await Users.getNameUser(id);
          added.push(`[ ${id} ] » ${name}`);
        }
      } else {
        return response.reply("Please provide a valid user ID or mention.");
      }

      saveConfig();
      return response.reply(
        added.length
          ? `[Developers] Added ${added.length} developer(s):\n\n${added.join("\n")}`
          : "[Developers] No new developers were added (already in list)."
      );
    }

    // ── God mode — reserved exclusively for the master DEVELOPER.ID ──────
    case "god": {
      if (!masterDevID || senderID !== masterDevID) {
        return response.reply('[Developers] Only the master developer can use "god".');
      }

      const added = [];

      if (mentionIDs.length > 0) {
        for (const id of mentionIDs) {
          if (!ADMINBOT.includes(id)) {
            ADMINBOT.push(id);
            const name = await Users.getNameUser(id);
            added.push(`[ ${id} ] » ${name}`);
          }
        }
      } else if (content.length > 0 && !isNaN(content[0])) {
        const id = content[0];
        if (!ADMINBOT.includes(id)) {
          ADMINBOT.push(id);
          const name = await Users.getNameUser(id);
          added.push(`[ ${id} ] » ${name}`);
        }
      } else {
        return response.reply("Please provide a valid user ID or mention.");
      }

      saveConfig();
      return response.reply(
        added.length
          ? `[Developers] (God) Force added ${added.length} developer(s):\n\n${added.join("\n")}`
          : "[Developers] No new developers were added (already in list)."
      );
    }

    // ── Remove — requires developer permission (level 3) ─────────────────
    case "remove":
    case "rm":
    case "delete": {
      if (permission < 3) {
        return response.reply('[Developers] You need developer permission to use "remove".');
      }

      const removed = [];

      if (mentionIDs.length > 0) {
        for (const id of mentionIDs) {
          const index = ADMINBOT.indexOf(id);
          if (index !== -1) {
            ADMINBOT.splice(index, 1);
            const name = await Users.getNameUser(id);
            removed.push(`[ ${id} ] » ${name}`);
          }
        }
      } else if (content.length > 0 && !isNaN(content[0])) {
        const id    = content[0];
        const index = ADMINBOT.indexOf(id);
        if (index !== -1) {
          ADMINBOT.splice(index, 1);
          const name = await Users.getNameUser(id);
          removed.push(`[ ${id} ] » ${name}`);
        }
      } else {
        return response.reply("Please provide a valid user ID or mention.");
      }

      saveConfig();
      return response.reply(
        removed.length
          ? `[Developers] Removed ${removed.length} developer(s):\n\n${removed.join("\n")}`
          : "[Developers] No developers were removed (not found in list)."
      );
    }

    default:
      return showList();
  }
}
