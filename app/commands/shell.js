import { exec }      from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const meta = {
  name:        'shell',
  version:     '1.0.0',
  type:        'developer',
  author:      'Mirai Team | Convert by AjiroDesu',
  description: 'Execute shell commands from the bot.',
  category:    'system',
  guide:       ['<command>'],
  cooldowns:   3,
};

export async function onStart({ args, response, usage }) {
  const command = args.join(' ').trim();
  if (!command) return usage();

  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 15000 });
    const output = stdout?.trim() || stderr?.trim() || '(No output)';
    return response.reply(`📟 Shell Output\n\`\`\`\n$ ${command}\n\n${output}\n\`\`\``);
  } catch (error) {
    const errMsg = error.stderr?.trim() || error.message || 'Unknown error';
    return response.reply(`🔴 Command failed:\n\`\`\`\n$ ${command}\n\n${errMsg}\n\`\`\``);
  }
}
