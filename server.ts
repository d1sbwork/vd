import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Bot } from 'grammy';
import dotenv from 'dotenv';

// Load environmental variables
dotenv.config();

// Robust environment setup supporting both CommonJS (bundled) and ES Modules (tsx dev)
const computedFilename = (() => {
  try {
    // In ES Modules, referencing `__filename` at runtime throws a ReferenceError.
    // By wrapping it in try-catch without block-scoped shadows, we handle it perfectly.
    return typeof __filename !== 'undefined' ? __filename : '';
  } catch {
    return '';
  }
})() || (typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : '');

const computedDirname = (() => {
  try {
    return typeof __dirname !== 'undefined' ? __dirname : '';
  } catch {
    return '';
  }
})() || (computedFilename ? path.dirname(computedFilename) : process.cwd());

// For local script purposes
const serverFilename = computedFilename;
const serverDirname = computedDirname;

const PORT = 3000;

// Read Firebase Config
const fbConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  if (fs.existsSync(fbConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
  }
} catch (err) {
  console.error('Error loading firebase-applet-config.json:', err);
}

// Initialize Firebase client
let db: any = null;
try {
  if (firebaseConfig.apiKey) {
    const fbApp = initializeApp(firebaseConfig);
    db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    console.log('💚 Firebase SDK initialized on Express Server.');
  } else {
    console.error('⚠️ Firebase configuration is invalid or missing.');
  }
} catch (err) {
  console.error('❌ Failed to initialize Firebase on server:', err);
}

// Telegram bot setup
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot: Bot | null = null;

function getShortModeNameRussian(mode: string) {
  switch (mode) {
    case 'classic_dm': return 'Бой насмерть (Deathmatch)';
    case 'competitive': return 'Соревновательный (MM)';
    case 'allies': return 'Союзники (2x2)';
    case 'custom_duel': return 'Дуэль (1x1)';
    case 'spray_training': return 'Тренировка спрея';
    default: return mode || 'Обычное лобби';
  }
}

if (!botToken) {
  console.log('⚠️ TELEGRAM_BOT_TOKEN environment variable is not defined. Telegram Bot notifications are disabled.');
} else {
  try {
    bot = new Bot(botToken);
    console.log('🤖 Telegram Bot initialized.');

    // Commands to interact with the bot from Telegram
    bot.command('start', async (ctx) => {
      const currentChatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || ctx.chat?.first_name || 'Игрок';
      const username = ctx.from?.username ? `@${ctx.from.username}` : (ctx.chat?.username ? `@${ctx.chat.username}` : '');
      
      try {
        if (db) {
          // Save the subscriber to Firestore for direct private notifications
          const subDocRef = doc(db, 'telegram_subscribers', currentChatId);
          await setDoc(subDocRef, {
            chatId: currentChatId,
            firstName,
            username,
            subscribedAt: new Date().toISOString()
          });
        }

        await ctx.reply(
          `Привет, ${firstName}\n` +
          `это официальный новый проект создан под дм, все киберспортсмены со всего мира по Standoff 2 соревнуются здесь, при создании любого лобби я пришлю тебе уведомления, будь на чеку 😉`
        );
      } catch (err) {
        console.error('Error in /start subscription command:', err);
        await ctx.reply('❌ Произошла ошибка при настройке подписки. Пожалуйста, попробуйте позже.');
      }
    });

    bot.command('stop', async (ctx) => {
      const currentChatId = ctx.chat.id.toString();
      try {
        if (db) {
          const subDocRef = doc(db, 'telegram_subscribers', currentChatId);
          await deleteDoc(subDocRef);
          await ctx.reply(
            `🔕 *Вы успешно отписались от личных уведомлений.* \n\n` +
            `Я больше не буду присылать вам новые лобби в ЛС. Вы можете подписаться заново в любой момент, отправив /start.`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await ctx.reply('❌ Ошибка связи с базой данных. Пожалуйста, попробуйте позже.');
        }
      } catch (err) {
        console.error('Error in /stop command:', err);
        await ctx.reply('❌ Ошибка при отписке. Пожалуйста, попробуйте еще раз.');
      }
    });

    bot.command('lobbies', async (ctx) => {
      if (!db) {
        await ctx.reply('❌ Ошибка: База данных Firebase не подключена на сервере.');
        return;
      }
      try {
        const lobbiesCol = collection(db, 'lobbies');
        const snapshot = await getDocs(lobbiesCol);
        const list: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === 'active' || data.status === 'full') {
            list.push({ id: doc.id, ...data });
          }
        });

        if (list.length === 0) {
          await ctx.reply('💤 На данный момент активных лобби нет. Создайте новое лобби в веб-приложении!');
          return;
        }

        let response = '🎮 *Список активных лобби Standoff 2:* \n\n';
        list.forEach((lobby, index) => {
          const formattedMode = getShortModeNameRussian(lobby.gameMode);
          response += `${index + 1}. *${lobby.creatorName}* (${formattedMode})\n`;
          response += `🗺 Карта: *${lobby.map}*\n`;
          response += `🔢 Код лобби: \`${lobby.lobbyCode}\`\n`;
          response += `👥 Игроков: \`${lobby.joinedPlayerCount}/${lobby.maxPlayers}\`\n`;
          if (lobby.description) response += `📝 _${lobby.description}_\n`;
          response += `────────────────────\n`;
        });

        await ctx.reply(response, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error in /lobbies command:', error);
        await ctx.reply('❌ Произошла ошибка при получении списка лобби.');
      }
    });

    // Run Bot safely
    bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Bot @${botInfo.username} started listening on Telegram!`);
      }
    }).catch((err) => {
      console.error('❌ Telegram Bot polling error:', err);
    });

  } catch (err) {
    console.error('❌ Failed to initialize Telegram Bot:', err);
  }
}

// Track and notification logic
if (db && bot) {
  const lobbyStateMap = new Map<string, string>();
  let isInitialLoad = true;

  const lobbiesCol = collection(db, 'lobbies');
  onSnapshot(lobbiesCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const lobbyId = change.doc.id;
      const lobbyData = change.doc.data() as any;

      if (isInitialLoad) {
        lobbyStateMap.set(lobbyId, lobbyData.status);
        return;
      }

      if (change.type === 'added') {
        if (lobbyData.status === 'active' || lobbyData.status === 'full') {
          sendLobbyCreatedNotification(lobbyData);
        }
        lobbyStateMap.set(lobbyId, lobbyData.status);
      } else if (change.type === 'modified') {
        const oldStatus = lobbyStateMap.get(lobbyId);
        const newStatus = lobbyData.status;

        if (oldStatus !== newStatus) {
          if ((oldStatus === 'active' || oldStatus === 'full' || !oldStatus) && newStatus === 'started') {
            sendMatchStartedNotification(lobbyData);
          }
          lobbyStateMap.set(lobbyId, newStatus);
        }
      } else if (change.type === 'removed') {
        lobbyStateMap.delete(lobbyId);
      }
    });

    if (isInitialLoad) {
      isInitialLoad = false;
      console.log('✅ Realtime snapshot tracker for Telegram notifications loaded.');
    }
  }, (error) => {
    console.error('Snapshot tracker error:', error);
  });
}

async function getTelegramSubscribers(): Promise<string[]> {
  const subscribers: string[] = [];
  if (process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID !== 'ВАШ_ID_ЧАТА') {
    subscribers.push(process.env.TELEGRAM_CHAT_ID);
  }
  
  if (!db) return subscribers;

  try {
    const subsCol = collection(db, 'telegram_subscribers');
    const snapshot = await getDocs(subsCol);
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.chatId && !subscribers.includes(data.chatId)) {
        subscribers.push(data.chatId);
      }
    });
  } catch (error) {
    console.error('Error fetching telegram subscribers from Firestore:', error);
  }

  return subscribers;
}

async function safeSendMessage(chatId: string, msg: string, options?: any) {
  if (!bot) return;
  try {
    await bot.api.sendMessage(chatId, msg, { parse_mode: 'Markdown', ...options });
  } catch (err: any) {
    console.error(`Failed to send Telegram message to ${chatId}:`, err);
    // Auto-cleanup if the bot was blocked or deactivated by the user
    const isDeactivated = err.description && (
      err.description.includes('blocked') ||
      err.description.includes('deactivated') ||
      err.description.includes('chat not found') ||
      err.description.includes('Forbidden')
    );
    if (isDeactivated && db) {
      try {
        const subDocRef = doc(db, 'telegram_subscribers', chatId);
        await deleteDoc(subDocRef);
        console.log(`🧹 Auto-removed blocked/deactivated Telegram subscription for chatId: ${chatId}`);
      } catch (dbErr) {
        console.error(`Failed to remove dead subscriber ${chatId} from Firestore:`, dbErr);
      }
    }
  }
}

// Keep track of the latest known app URL for opening Telegram WebApps
let lastKnownAppUrl = process.env.APP_URL || 'https://ais-dev-hub22ta5vpcuwb7jora6hq-447950106568.europe-west2.run.app';

async function sendLobbyCreatedNotification(lobby: any) {
  if (!bot) {
    console.log('⏩ Skipping notification: Telegram bot is not initialized.');
    return;
  }
  try {
    const targets = await getTelegramSubscribers();
    if (targets.length === 0) {
      console.log('⏩ Skipping notification: No Telegram subscribers or custom chat ID is configured.');
      return;
    }

    const lobbyUrl = lobby.appUrl || lastKnownAppUrl;

    const hostNameClean = lobby.creatorName || 'Хост';

    let msg = `СОЗДАНО НОВОЕ ЛОББИ STANDOFF 2\n\n`;
    msg += `Хост: ${hostNameClean}\n`;
    msg += `Режим: Deatmatch\n`;
    msg += `Карта: ${lobby.map || 'Неизвестна'}`;

    const options = lobbyUrl ? {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Играть бесплатно ↗", web_app: { url: lobbyUrl } }
          ]
        ]
      }
    } : undefined;

    // Broadcast in parallel
    await Promise.all(targets.map(id => safeSendMessage(id, msg, options)));
    console.log(`[Notification] Broadcasted 'Lobby Created' for lobby code ${lobby.lobbyCode} to ${targets.length} targets.`);
  } catch (err) {
    console.error('Failed to send lobby created Telegram notification:', err);
  }
}

async function sendMatchStartedNotification(lobby: any) {
  if (!bot) {
    console.log('⏩ Skipping notification: Telegram bot is not initialized.');
    return;
  }
  try {
    const targets = await getTelegramSubscribers();
    if (targets.length === 0) {
      console.log('⏩ Skipping notification: No Telegram subscribers or custom chat ID is configured.');
      return;
    }

    const lobbyUrl = lobby.appUrl || lastKnownAppUrl;
    const hostNameClean = lobby.creatorName || 'Хост';

    let msg = `МАТЧ НАЧАЛСЯ ИГРА СТАРТОВАЛА\n\n`;
    msg += `Хост: ${hostNameClean}\n`;
    msg += `Режим: Deatmatch\n`;
    msg += `Карта: ${lobby.map || 'Неизвестна'}`;

    const options = lobbyUrl ? {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Играть бесплатно ↗", web_app: { url: lobbyUrl } }
          ]
        ]
      }
    } : undefined;

    // Broadcast in parallel
    await Promise.all(targets.map(id => safeSendMessage(id, msg, options)));
    console.log(`[Notification] Broadcasted 'Match Started' for lobby code ${lobby.lobbyCode} to ${targets.length} targets.`);
  } catch (err) {
    console.error('Failed to send match started Telegram notification:', err);
  }
}

async function startServer() {
  const app = express();

  // Parse JSON payloads
  app.use(express.json());

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      telegramBotActive: !!bot,
      telegramChatIdConfigured: !!process.env.TELEGRAM_CHAT_ID
    });
  });

  // Direct REST trigger for lobby created notifications
  app.post('/api/notify/created', async (req, res) => {
    try {
      const lobbyData = req.body;
      if (!lobbyData || !lobbyData.lobbyCode) {
        return res.status(400).json({ error: 'Missing lobby data or code' });
      }

      if (lobbyData.appUrl) {
        lastKnownAppUrl = lobbyData.appUrl;
      }

      console.log(`📡 REST: Triggering 'Lobby Created' notification for code ${lobbyData.lobbyCode}. URL update: ${lastKnownAppUrl}`);
      await sendLobbyCreatedNotification(lobbyData);
      res.json({ success: true });
    } catch (err: any) {
      console.error('REST Notification error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  });

  // Direct REST trigger for match started notifications
  app.post('/api/notify/started', async (req, res) => {
    try {
      const lobbyData = req.body;
      if (!lobbyData || !lobbyData.lobbyCode) {
        return res.status(400).json({ error: 'Missing lobby data or code' });
      }

      if (lobbyData.appUrl) {
        lastKnownAppUrl = lobbyData.appUrl;
      }

      console.log(`📡 REST: Triggering 'Match Started' notification for code ${lobbyData.lobbyCode}. URL update: ${lastKnownAppUrl}`);
      await sendMatchStartedNotification(lobbyData);
      res.json({ success: true });
    } catch (err: any) {
      console.error('REST Notification error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  });

  // Serve Frontend with Vite Middleware in Dev, or serve built bundle in Production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Explicitly serve and transform index.html for client-side routing and dev reload support
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const htmlPath = path.resolve(process.cwd(), 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');
        html = await vite.transformIndexHtml(url, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });

    console.log('⚡ Vite dev middleware integrated into Express server.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('📦 Static files middleware serve from /dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fullstack server running on http://0.0.0.0:${PORT}`);
    console.log(`🌍 Live Preview at: ${process.env.APP_URL || 'http://localhost:3000'}`);
  });
}

startServer();
