require("dotenv").config();

const express = require("express");
const { Bot } = require("node-telegram-bot-api");
const { redis, connectRedis } = require("./redis");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

const bot = new Bot(TOKEN);

const PERSON_A = "relay:personA";
const PERSON_B = "relay:personB";


// ==================================================
// START
// ==================================================

bot.command("start", async (ctx) => {
    await ctx.reply(
        "Welcome to the relay bot."
    );
});


// ==================================================
// REGISTER PERSON A
// ==================================================

bot.command("registerA", async (ctx) => {

    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);

    await redis.hSet(PERSON_A, {
        userId,
        chatId,
        name: ctx.from.first_name || "Person A"
    });

    await ctx.reply(
        "You are registered as Person A."
    );

    console.log("Person A:", {
        userId,
        chatId
    });
});


// ==================================================
// REGISTER PERSON B
// ==================================================

bot.command("registerB", async (ctx) => {

    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);

    await redis.hSet(PERSON_B, {
        userId,
        chatId,
        name: ctx.from.first_name || "Person B"
    });

    await ctx.reply(
        "You are registered as Person B."
    );

    console.log("Person B:", {
        userId,
        chatId
    });
});


// ==================================================
// ALL NORMAL MESSAGES
// ==================================================

bot.on("message", async (ctx) => {

    const message = ctx.message;

    // Ignore commands
    if (message.text?.startsWith("/")) {
        return;
    }

    // Ignore messages sent by bots
    if (message.from?.is_bot) {
        return;
    }

    const chatId = String(message.chat.id);
    const senderId = String(message.from.id);

    const personA = await redis.hGetAll(PERSON_A);
    const personB = await redis.hGetAll(PERSON_B);


    // ==================================================
    // MESSAGE FROM GROUP
    // ==================================================

    if (chatId === String(GROUP_CHAT_ID)) {

        let sender;
        let receiver;

        if (senderId === personA.userId) {

            sender = personA;
            receiver = personB;

        } else if (senderId === personB.userId) {

            sender = personB;
            receiver = personA;

        } else {

            console.log(
                "Unknown person sent message in group:",
                senderId
            );

            return;
        }


        if (!receiver.chatId) {

            console.log(
                "Receiver has not registered the bot."
            );

            return;
        }


        if (!message.text) {
            return;
        }


        const formattedMessage =
            `${sender.name}: ${message.text}`;


        // Send to other person's private chat
        await bot.api.sendMessage(
            receiver.chatId,
            formattedMessage
        );


        // Delete original group message
        try {

            await bot.api.deleteMessage(
                GROUP_CHAT_ID,
                message.message_id
            );

        } catch (error) {

            console.error(
                "Failed to delete group message:",
                error.message
            );

        }


        // Re-post in group
        await bot.api.sendMessage(
            GROUP_CHAT_ID,
            formattedMessage
        );

        return;
    }


    // ==================================================
    // MESSAGE FROM PRIVATE CHAT
    // ==================================================

    if (message.chat.type === "private") {

        let sender;

        if (senderId === personA.userId) {

            sender = personA;

        } else if (senderId === personB.userId) {

            sender = personB;

        } else {

            await ctx.reply(
                "You are not registered with this relay bot."
            );

            return;
        }


        if (!message.text) {
            return;
        }


        const formattedMessage =
            `${sender.name}: ${message.text}`;


        // Send message into group
        await bot.api.sendMessage(
            GROUP_CHAT_ID,
            formattedMessage
        );
    }
});


// ==================================================
// WEBHOOK
// ==================================================

app.post("/telegram/webhook", async (req, res) => {

    try {

        await bot.handleUpdate(req.body);

        res.sendStatus(200);

    } catch (error) {

        console.error(
            "Webhook processing error:",
            error
        );

        res.sendStatus(500);
    }
});


// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/", (req, res) => {

    res.send(
        "Telegram relay bot is running."
    );

});


// ==================================================
// START SERVER
// ==================================================

async function start() {

    try {

        await connectRedis();

        console.log("Redis connected.");

        app.listen(PORT, async () => {

            console.log(
                `Server running on port ${PORT}`
            );

            const webhookUrl = WEBHOOK_URL 

            try {

                await bot.api.setWebhook(
                    webhookUrl
                );

                console.log(
                    "Webhook set:",
                    webhookUrl 
                );

            } catch (error) {

                console.error(
                    "Failed to set webhook:",
                    error.message
                );

            }

        });

    } catch (error) {

        console.error(
            "Failed to start application:",
            error
        );

        process.exit(1);
    }
}

start();
