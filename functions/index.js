/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Use the v2 syntax for modern functions
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require('firebase-functions/params'); 
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { onRequest, onCall } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

const telegramToken = defineSecret('TELEGRAM_TOKEN'); 

let bot = null;

exports.linkTelegramAccount = onCall({ region: "asia-southeast1" }, async (request) => {
  // Ensure the user is logged into the website
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const telegramId = request.data.telegramId;
  const username = request.data.username || 'Unknown';
  const email = request.auth.token.email;

  // Save the link in a 'telegram_links' collection
  // Document ID is the Telegram User ID (e.g., "123456789")
  await db.collection("telegram_links").doc(String(telegramId)).set({
    firebaseUid: request.auth.uid,
    email: email,
    telegramUsername: username,
    linkedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, email: email };
});


const getBot = () => {
  if (bot) return bot;
  bot = new Telegraf(telegramToken.value());

  // Command to generate the login link
  bot.command('start', (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || '';
    // Replace with your actual hosted URL
    const webUrl = `https://returnscoi.vercel.app/settings?tgId=${telegramId}&tgName=${username}`;
    
    ctx.reply(`🔗 To verify your account, please click this link and confirm on the website:\n\n${webUrl}`);
  });

    bot.command('help', (ctx) => 
    ctx.reply(`Click /start to verify your Telegram account via logging into the Returns website, then you can start using the bot by sending images to it to upload it!`)
  );

  bot.on("photo", async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      // CHECK: Look up the link in Firestore
      const linkDoc = await db.collection("telegram_links").doc(String(telegramId)).get();

      if (!linkDoc.exists) {
        return ctx.reply("⛔ Account not linked. Please type /start to get a verification link.");
      }

      const userData = linkDoc.data();
      
      // If linked, proceed with upload...
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      
      await ctx.reply(`Authenticated as ${userData.email}. Uploading...`);

      const response = await axios({
        url: fileLink.href,
        method: "GET",
        responseType: "arraybuffer",
      });

      const timestamp = new Date();
      const fileName = `images/telegram_${timestamp.getTime()}.jpg`;
      const file = bucket.file(fileName);

      await file.save(response.data, {
        metadata: {
          contentType: "image/jpeg",
          metadata: {
            // Use the email from the Firebase Auth link
            uploaderEmail: userData.email, 
            uploadTimestamp: timestamp.toISOString(),
            remarks: ctx.message.caption || "",
            telegramUserId: String(telegramId)
          },
        },
      });

      await ctx.reply("✅ Success! Image uploaded.");
    } catch (error) {
      logger.error("Error:", error);
      await ctx.reply("❌ Upload failed.");
    }
  });

  return bot;
};

// --- 3. The Webhook Function ---
// Now that telegramToken is a defineSecret(), passing it here is valid.
exports.telegramWebhook = onRequest(
  { region: "asia-southeast1", secrets: [telegramToken] }, 
  async (req, res) => {
    try {
      const myBot = getBot();
      await myBot.handleUpdate(req.body);
    } catch (e) {
      logger.error("Webhook processing error", e);
    } finally {
      res.status(200).end();
    }
  }
);

// --- 4. Cleanup Function (v2 Syntax - Kept from previous steps) ---
exports.cleanupDeletedNotes = onSchedule("every 24 hours", async (event) => {
  const now = admin.firestore.Timestamp.now();
  const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);

  const oldDeletedNotesQuery = db.collection("notes")
      .where("isDeleted", "==", true)
      .where("deletedAt", "<=", sevenDaysAgo);

  const snapshot = await oldDeletedNotesQuery.get();

  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  logger.log(`Successfully deleted ${snapshot.size} old note(s).`);
});