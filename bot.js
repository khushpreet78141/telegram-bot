require("dotenv").config();

const express = require("express");
const { Bot } = require("node-telegram-bot-api");
const { redis, connectRedis } = require("./redis");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

const bot = new Bot(TOKEN);

// Redis keys
const PERSON_A = "relay:personA";
const PERSON_B = "relay:personB";
const PERSON_C = "relay:personC";


// ============================================
// START
// ============================================

bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to the relay bot.");
});


// ============================================
// REGISTER A
// ============================================

bot.command("registerA", async (ctx) => {

    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);

    await redis.hSet(PERSON_A, {
        userId,
        chatId,
        name: ctx.from.first_name || "Person A"
    });

    await ctx.reply("You are registered as Person A.");

    console.log("Person A registered:", {
        userId,
        chatId
    });
});


// ============================================
// REGISTER B
// ============================================

bot.command("registerB", async (ctx) => {

    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);

    await redis.hSet(PERSON_B, {
        userId,
        chatId,
        name: ctx.from.first_name || "Person B"
    });

    await ctx.reply("You are registered as Person B.");

    console.log("Person B registered:", {
        userId,
        chatId
    });
});


// ============================================
// REGISTER C
// ============================================

bot.command("registerC", async (ctx) => {

    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);

    await redis.hSet(PERSON_C, {
        userId,
        chatId,
        name: ctx.from.first_name || "Person C"
    });

    await ctx.reply("You are registered as Person C.");

    console.log("Person C registered:", {
        userId,
        chatId
    });
});


// ============================================
// MESSAGE HANDLER
// ============================================

bot.on("message", async (ctx) => {
    console.log("MESSAGE RECEIVED:", ctx.message);
    console.log("CHAT ID:", ctx.chat.id);
console.log("CHAT TYPE:", ctx.chat.type);
    const message = ctx.message;

    // Ignore commands
    if (message.text?.startsWith("/")) {
        return;
    }

    // Ignore bot messages
    if (message.from?.is_bot) {
        return;
    }

    const chatId = String(message.chat.id);
    const senderId = String(message.from.id);

    const personA = await redis.hGetAll(PERSON_A);
    const personB = await redis.hGetAll(PERSON_B);
    const personC = await redis.hGetAll(PERSON_C);


    // ========================================
    // A/B → GROUP → C
    // ========================================

    if (chatId === String(GROUP_CHAT_ID)) {

        let sender;

        if (senderId === personA.userId) {

            sender = personA;

        } else if (senderId === personB.userId) {

            sender = personB;

        } else {

            // Unknown group member
            return;
        }


        // C must be registered
        if (!personC.chatId) {

            console.log(
                "Person C is not registered."
            );

            return;
        }


        // Only text messages for now
        if (!message.text) {
            return;
        }


        // Send original sender's identity to C
        const privateMessage =
            `${sender.name}: ${message.text}`;

        await bot.api.sendMessage(
            personC.chatId,
            privateMessage
        );


        // Delete original A/B message
        try {

            await bot.api.deleteMessage(
                GROUP_CHAT_ID,
                message.message_id
            );

        } catch (error) {

            console.error(
                "Could not delete group message:",
                error.message
            );

        }


        // Re-post as Person C
        const groupMessage =
            `Person C: ${message.text}`;

        await bot.api.sendMessage(
            GROUP_CHAT_ID,
            groupMessage
        );

        return;
    }


    // ========================================
    // C → BOT DM → GROUP
    // ========================================

    if (message.chat.type === "private") {

        // Only C can send private messages
        if (senderId !== personC.userId) {

            return;
        }


        // Only text messages for now
        if (!message.text) {
            return;
        }


        const groupMessage =
            `Person C: ${message.text}`;

        await bot.api.sendMessage(
            GROUP_CHAT_ID,
            groupMessage
        );
    }
});


// ============================================
// WEBHOOK
// ============================================

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


// ============================================
// HEALTH CHECK
// ============================================

app.get("/", (req, res) => {

    res.send("Telegram relay bot is running.");

});


// ============================================
// START SERVER
// ============================================

async function start() {

    try {

        await connectRedis();

        console.log("Redis connected.");

        app.listen(PORT, async () => {

            console.log(
                `Server running on port ${PORT}`
            );

            try {

             const result = await bot.api.setWebhook(WEBHOOK_URL);

console.log("setWebhook result:", result);
console.log("Webhook URL:", WEBHOOK_URL);

               

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
