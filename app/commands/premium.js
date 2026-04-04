import fs from "fs-extra";

export const meta = {
  name: "premium",
  aliases: ["vip"],
  version: "1.1.0",
  type: "anyone",
  author: "Converted by ChatGPT",
  description: "Manage premium users",
  category: "config",
  guide: ["list | add/remove/god <userID> or mention"],
  cooldowns: 5
};

export async function onStart({ event, args, Users, response }) {
  const { mentions, senderID } = event;
  const content    = args.slice(1);
  const mentionIDs = Object.keys(mentions || {});

  const { configPath } = global.client;
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!config.PREMIUM)        config.PREMIUM        = [];
  if (!global.config.PREMIUM) global.config.PREMIUM = [];

  const PREMIUM     = global.config.PREMIUM;
  const ADMINBOT    = global.config.ADMINBOT || [];

  // Master developer — single string ID from DEVELOPER.ID in config
  const masterDevID = String(global.config.DEVELOPER?.ID || "");

  const saveConfig = () => {
    config.PREMIUM        = [...new Set(PREMIUM)];
    global.config.PREMIUM = [...new Set(PREMIUM)];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
  };

  const showList = async () => {
    const lines = [];
    for (const id of PREMIUM) {
      const name = await Users.getNameUser(id);
      lines.push(`- ${name} (${id})`);
    }
    return response.reply(
      `[Premium] Premium user list:\n\n${lines.join("\n") || "No premium users found."}`
    );
  };

  if (!args[0]) return showList();

  switch (args[0]) {
    case "list":
    case "all":
    case "-a":
      return showList();

    // ── Standard add — requires ADMINBOT ─────────────────────────────────
    case "add": {
      if (!ADMINBOT.includes(senderID)) {
        return response.reply("[Premium] Only bot admins can add premium users.");
      }

      const added = [];

      if (mentionIDs.length > 0) {
        for (const id of mentionIDs) {
          if (!PREMIUM.includes(id)) {
            PREMIUM.push(id);
            const name = await Users.getNameUser(id);
            added.push(`[ ${id} ] » ${name}`);
          }
        }
      } else if (content.length > 0 && !isNaN(content[0])) {
        const id = content[0];
        if (!PREMIUM.includes(id)) {
          PREMIUM.push(id);
          const name = await Users.getNameUser(id);
          added.push(`[ ${id} ] » ${name}`);
        }
      } else {
        return response.reply("Please provide a valid user ID or mention.");
      }

      saveConfig();
      return response.reply(
        added.length
          ? `[Premium] Added ${added.length} premium user(s):\n\n${added.join("\n")}`
          : "[Premium] No new premium users were added (already in list)."
      );
    }

    // ── God mode — reserved exclusively for the master DEVELOPER.ID ──────
    case "god": {
      if (!masterDevID || senderID !== masterDevID) {
        return response.reply('[Premium] Only the master developer can use "god".');
      }

      const added = [];

      if (mentionIDs.length > 0) {
        for (const id of mentionIDs) {
          if (!PREMIUM.includes(id)) {
            PREMIUM.push(id);
            const name = await Users.getNameUser(id);
            added.push(`[ ${id} ] » ${name}`);
          }
        }
      } else if (content.length > 0 && !isNaN(content[0])) {
        const id = content[0];
        if (!PREMIUM.includes(id)) {
          PREMIUM.push(id);
          const name = await Users.getNameUser(id);
          added.push(`[ ${id} ] » ${name}`);
        }
      } else {
        return response.reply("Please provide a valid user ID or mention.");
      }

      saveConfig();
      return response.reply(
        added.length
          ? `[Premium] (God) Force added ${added.length} premium user(s):\n\n${added.join("\n")}`
          : "[Premium] No new premium users were added (already in list)."
      );
    }

    // ── Standard remove — requires ADMINBOT ──────────────────────────────
    case "remove":
    case "rm":
    case "delete": {
      if (!ADMINBOT.includes(senderID)) {
        return response.reply("[Premium] Only bot admins can remove premium users.");
      }

      const removed = [];

      if (mentionIDs.length > 0) {
        for (const id of mentionIDs) {
          const index = PREMIUM.indexOf(id);
          if (index !== -1) {
            PREMIUM.splice(index, 1);
            const name = await Users.getNameUser(id);
            removed.push(`[ ${id} ] » ${name}`);
          }
        }
      } else if (content.length > 0 && !isNaN(content[0])) {
        const id    = content[0];
        const index = PREMIUM.indexOf(id);
        if (index !== -1) {
          PREMIUM.splice(index, 1);
          const name = await Users.getNameUser(id);
          removed.push(`[ ${id} ] » ${name}`);
        }
      } else {
        return response.reply("Please provide a valid user ID or mention.");
      }

      saveConfig();
      return response.reply(
        removed.length
          ? `[Premium] Removed ${removed.length} premium user(s):\n\n${removed.join("\n")}`
          : "[Premium] No premium users were removed (not found in list)."
      );
    }

    default:
      return showList();
  }
}
