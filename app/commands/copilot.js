import axios from "axios";

export const meta = {
  name: "copilot",
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

export async function onStart({ api, event, args }) {
  const { threadID, messageID } = event;

  let prompt = args.join(" ").trim();

  // Support replying to a message (use replied text as prompt)
  if (event.type === "message_reply") {
    const replyBody = event.messageReply?.body?.trim() || "";
    if (prompt) {
      prompt = prompt + " " + replyBody;
    } else {
      prompt = replyBody;
    }
  }

  if (!prompt) {
    return api.sendMessage(
      "❌ Please provide a message after 'copilot' or reply to a message!",
      threadID,
      messageID
    );
  }

  try {
    const response = await axios.get(
      `${global.endpoint.ajiro}/ai/copilot`,
      {
        params: {
          message: prompt,
          model: "gpt-5"
        }
      }
    );

    const data = response.data;

    if (data && data.answer) {
      return api.sendMessage(data.answer, threadID, messageID);
    } else {
      return api.sendMessage(
        "❌ No response received from the AI.",
        threadID,
        messageID
      );
    }
  } catch (error) {
    console.error("[COPILOT ERROR]", error);
    return api.sendMessage(
      `❌ API Error: ${error.message || "Failed to connect to Ajiro API"}`,
      threadID,
      messageID
    );
  }
}