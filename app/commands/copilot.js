import axios from "axios";

export const meta = {
  name: "copilot",
  aliases: ["ai"],
  version: "1.0.0",
  type: "anyone",
  author: "AjiroDesu",
  description: "Chat with AI Copilot (GPT-5) using the Ajiro API.",
  category: "ai",
  guide: [
    "<your message>",
    "Reply to any message with 'copilot' (no text needed)"
  ],
  cooldowns: 5
};

export async function onStart({ event, args, response, usage }) {
  let prompt = args.join(" ").trim();

  // Support replying to a message — append replied body as context
  if (event.type === "message_reply") {
    const replyBody = event.messageReply?.body?.trim() || "";
    prompt = prompt ? `${prompt} ${replyBody}` : replyBody;
  }

  if (!prompt) return usage();

  try {
    const { data } = await axios.get(`${global.endpoint.ajiro}/ai/copilot`, {
      params: { message: prompt, model: "gpt-5" }
    });

    if (data?.answer) {
      return response.reply(data.answer);
    }

    return response.reply("❌ No response received from the AI.");
  } catch (error) {
    console.error("[COPILOT ERROR]", error);
    return response.reply(
      `❌ API Error: ${error.message || "Failed to connect to Ajiro API"}`
    );
  }
}
