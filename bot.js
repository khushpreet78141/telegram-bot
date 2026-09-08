console.log("Starting bot.js...");

import "dotenv/config";
import cron from 'node-cron';
import { run } from "node-telegram-bot-api/node";
import { Bot,Api } from "node-telegram-bot-api";

const bot = new Bot(process.env.BOT_TOKEN);
const api = new Api(process.env.BOT_TOKEN);
console.log("Bot object created");

console.log("Token loaded:", !!process.env.BOT_TOKEN);
bot.command("start", async (ctx) => {
  await ctx.reply(
    //`Hello ${ctx.from?.first_name || "there"}!\n` +
    //`Your bot is working.\n\n` +
    //`Your Chat ID: ${ctx.chat.id}`
    `Bot is working .... `
  );
});
const CHAT_ID = 6086818159;

cron.schedule('0 */2 * * *', async() => {
    try{
         await api.sendMessage(
            {
                chat_id:      CHAT_ID,
 text: "I Love You Sweetheart 🥰"
            }

);
    console.log("Message has been sent ");
    }catch(err){
        console.error("error is logging:",err);
    }
});

console.log("Starting Telegram polling...");

await run(bot);

console.log("Bot is running!");


