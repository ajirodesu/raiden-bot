import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const meta = {
  name: "shell",
  version: "1.0.0",
  type: "developer",
  author: "AjiroDesu",
  description: "Execute shell commands from the bot.",
  category: "system",
  guide: ["<command>"],
  cooldowns: 3
};

export async function onStart({ api, event, args }) {
  const { threadID, messageID } = event;

  const command = args.join(" ").trim();

  if (!command) {
    return api.sendMessage(
      "❌ Please provide a shell command to execute.\nExample: shell ls",
      threadID,
      messageID
    );
  }

  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 15000 });

    const output = stdout?.trim() || stderr?.trim() || "(No output)";

    return api.sendMessage(
      `📟 Shell Output\n\`\`\`\n$ ${command}\n\n${output}\n\`\`\``,
      threadID,
      messageID
    );
  } catch (error) {
    const errMsg = error.stderr?.trim() || error.message || "Unknown error";

    console.error("[SHELL ERROR]", error);
    return api.sendMessage(
      `❌ Command failed:\n\`\`\`\n$ ${command}\n\n${errMsg}\n\`\`\``,
      threadID,
      messageID
    );
  }
}