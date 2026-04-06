/**
 * shoot.js
 * --------
 * Ball gambling game — bet coins for a chance to double your money.
 * Win rate: 60%  |  Win: 2× bet  |  Loss: lose bet
 */

export const meta = {
  name:        'shoot',
  aliases:     ['basketball'],
  version:     '1.0.0',
  type:        'anyone',
  author:      'PrinceDev | Converted by AjiroDesu',
  description: 'Ball gambling game. Bet coins for a chance to double your money.',
  category:    'economy',
  guide:       ['<bet>'],
  cooldowns:   5,
};

export async function onStart({ event, args, Currencies, response }) {
  const { senderID } = event;

  if (!args[0]) {
    return response.reply('⚠️ Please enter your bet amount.\nUsage: shoot <amount>');
  }

  const betStr = args[0].trim();
  if (!/^\d+$/.test(betStr)) {
    return response.reply('⚠️ Please enter a valid positive number.');
  }

  const bet = parseInt(betStr, 10);
  if (!bet || bet <= 0) {
    return response.reply('⚠️ Bet must be greater than zero.');
  }

  const userData = await Currencies.getData(senderID);
  if (!userData) {
    return response.reply('⚠️ Could not load your account data. Try again.');
  }

  const balance = userData.money || 0;
  if (bet > balance) {
    return response.reply(
      `⚠️ Insufficient balance.\nYou have $${balance.toLocaleString()} but tried to bet $${bet.toLocaleString()}.`
    );
  }

  const WIN_RATE = 0.6;
  const isWin    = Math.random() <= WIN_RATE;

  if (isWin) {
    const winAmount = bet * 2;
    await Currencies.increaseMoney(senderID, winAmount);
    return response.reply(
      `The ball ⛹🏻‍♂️ was shot successfully! 🏀\n\n🎉 You won: $${winAmount.toLocaleString()}`
    );
  } else {
    await Currencies.decreaseMoney(senderID, bet);
    return response.reply(
      `The ball ⛹🏻‍♂️ missed! 🏀\n\n😔 You lost: $${bet.toLocaleString()}`
    );
  }
}
