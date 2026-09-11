
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Telegram webhook server is running");
});

app.post("/telegram/webhook", (req, res) => {
    console.log("Telegram update received:");
    console.log(JSON.stringify(req.body, null, 2));

    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Webhook server running on port ${PORT}`);
});

