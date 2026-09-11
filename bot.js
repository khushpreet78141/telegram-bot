require("dotenv").config();

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const { redis, connectRedis } = require("./redis");

const app = express();

app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

const bot = new TelegramBot(TOKEN);


// --------------------------------------------------
// Redis keys
// --------------------------------------------------

const PERSON_A = "relay:personA";
const PERSON_B = "relay:personB";


// --------------------------------------------------
// /start
// --------------------------------------------------

bot.onText(/^\/start$/, async (msg) => {

    const userId = String(msg.from.id);
    const chatId = String(msg.chat.id);

    console.log("START:", {
        userId,
        chatId,
        name: msg.from.first_name
    });

    await bot.sendMessage(
        msg.chat.id,
        "You are connected to the relay bot."
    );
});


// --------------------------------------------------
// Register Person A
// --------------------------------------------------

bot.onText(/^\/registerA$/, async (msg) => {

    const userId = String(msg.from.id);
    const chatId = String(msg.chat.id);

    await redis.hSet(PERSON_A, {
        userId,
        chatId,
        name: msg.from.first_name || "Person A"
    });

    await bot.sendMessage(
        msg.chat.id,
        "You have been registered as Person A."
    );

    console.log("Person A registered:", userId, chatId);
});


// --------------------------------------------------
// Register Person B
// --------------------------------------------------

bot.onText(/^\/registerB$/, async (msg) => {

    const userId = String(msg.from.id);
    const chatId = String(msg.chat.id);

    await redis.hSet(PERSON_B, {
        userId,
        chatId,
        name: msg.from.first_name || "Person B"
    });

    await bot.sendMessage(
        msg.chat.id,
        "You have been registered as Person B."
    );

    console.log("Person B registered:", userId, chatId);
});


// --------------------------------------------------
// GROUP MESSAGES
// --------------------------------------------------

bot.on("message", async (msg) => {

    // Only process messages from our configured group
    if (String(msg.chat.id) !== String(GROUP_CHAT_ID)) {
        return;
    }

    // Ignore bot's own messages
    if (msg.from?.is_bot) {
        return;
    }

    // Ignore commands
    if (msg.text?.startsWith("/")) {
        return;
    }

    const senderId = String(msg.from.id);

    const personA = await redis.hGetAll(PERSON_A);
    const personB = await redis.hGetAll(PERSON_B);

    let sender;
    let receiver;

    // ----------------------------------------------
    // Person A sent message
    // ----------------------------------------------

    if (senderId === personA.userId) {

        sender = personA;
        receiver = personB;

    }

    // ----------------------------------------------
    // Person B sent message
    // ----------------------------------------------

    else if (senderId === personB.userId) {

        sender = personB;
        receiver = personA;

    }

    // ----------------------------------------------
    // Unknown user
    // ----------------------------------------------

    else {

        console.log("Unknown group member:", senderId);

        return;
    }


    if (!receiver.chatId) {

        console.log("Receiver personal chat not registered.");

        return;
    }


    // ----------------------------------------------
    // Get message text
    // ----------------------------------------------

    if (!msg.text) {
        return;
    }

    const messageText = `${sender.name}: ${msg.text}`;


    // ----------------------------------------------
    // Send to receiver's personal chat
    // ----------------------------------------------

    await bot.sendMessage(
        receiver.chatId,
        messageText
    );


    // ----------------------------------------------
    // Delete original group message
    // ----------------------------------------------

    try {

        await bot.deleteMessage(
            GROUP_CHAT_ID,
            msg.message_id
        );

    } catch (error) {

        console.error(
            "Could not delete group message:",
            error.message
        );
    }


    // ----------------------------------------------
    // Re-post in group
    // ----------------------------------------------

    await bot.sendMessage(
        GROUP_CHAT_ID,
        messageText
    );

});


// --------------------------------------------------
// PERSONAL CHAT → GROUP
// --------------------------------------------------

bot.on("message", async (msg) => {

    // Ignore group messages
    if (String(msg.chat.id) === String(GROUP_CHAT_ID)) {
        return;
    }

    // Ignore commands
    if (msg.text?.startsWith("/")) {
        return;
    }

    // Only private chats
    if (msg.chat.type !== "private") {
        return;
    }

    const senderId = String(msg.from.id);

    const personA = await redis.hGetAll(PERSON_A);
    const personB = await redis.hGetAll(PERSON_B);

    let sender;

    if (senderId === personA.userId) {

        sender = personA;

    } else if (senderId === personB.userId) {

        sender = personB;

    } else {

        await bot.sendMessage(
            msg.chat.id,
            "You are not registered with this relay."
        );

        return;
    }


    if (!msg.text) {
        return;
    }


    const groupMessage =
        `${sender.name}: ${msg.text}`;


    // Send person's message into group
    await bot.sendMessage(
        GROUP_CHAT_ID,
        groupMessage
    );

});


// --------------------------------------------------
// WEBHOOK
// --------------------------------------------------

app.post("/telegram/webhook", (req, res) => {

    bot.processUpdate(req.body);

    res.sendStatus(200);

});


// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/", (req, res) => {

    res.send("Telegram relay bot is running.");

});


// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function start() {

    await connectRedis();

    app.listen(PORT, async () => {

        console.log(
            `Server running on port ${PORT}`
        );

        const webhook = `${WEBHOOK_URL}/telegram/webhook`;

        try {

            await bot.setWebHook(webhook);

            console.log(
                "Webhook set:",
                webhook
            );

        } catch (error) {

            console.error(
                "Webhook error:",
                error.message
            );

        }

    });

}

start();

