// Импортируем необходимые библиотеки
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const NodeCache = require('node-cache');
const moment = require('moment');

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Инициализация кэша для хранения данных
const cache = new NodeCache({ stdTTL: 86400 }); // хранение данных в течение 24 часов

// Константы для статусов запросов
const REQUEST_STATUS = {
  NEW: 'new',
  ANSWERED: 'answered',
  WAITING: 'waiting',
  TIMEOUT: 'timeout'
};

// Категории вопросов
const QUESTION_CATEGORIES = {
  HOMEWORK: 'homework',
  APP: 'app',
  TECHNICAL: 'technical',
  OTHER: 'other'
};

// Middleware для логирования
bot.use(async (ctx, next) => {
  const start = new Date();
  console.log(`Получено сообщение от ${ctx.from ? ctx.from.id : 'неизвестно'}`);
  await next();
  const ms = new Date() - start;
  console.log(`Обработка заняла ${ms}ms`);
});

// Обработка команды /start
bot.start(async (ctx) => {
  try {
    console.log('Получена команда /start от:', ctx.from ? ctx.from.id : 'неизвестно');
    
    const welcomeMessage = 'Привет! Я бот КурсНова для связи с куратором. Здесь ты можешь задать любой вопрос по домашней работе, приложению или получить техническую поддержку.';
    
    await ctx.reply(welcomeMessage, Markup.keyboard([
      ['❓ Задать вопрос'],
      ['📚 Частые вопросы', '📞 Связаться с командой']
    ]).resize());
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// [Остальной код бота скопирован из index.js]
// Здесь идут все остальные обработчики команд и сообщений

// Обработка нажатия на кнопку "Задать вопрос"
bot.hears('❓ Задать вопрос', async (ctx) => {
  try {
    await ctx.reply('Выберите тему вопроса:', Markup.inlineKeyboard([
      [Markup.button.callback('📝 Вопрос по домашней работе', 'question_homework')],
      [Markup.button.callback('📱 Вопрос по приложению', 'question_app')],
      [Markup.button.callback('🔧 Технический вопрос', 'question_technical')],
      [Markup.button.callback('🤔 Другое', 'question_other')]
    ]));
  } catch (error) {
    console.error('Ошибка при обработке кнопки "Задать вопрос":', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Функция для API Webhook
module.exports = async (req, res) => {
  try {
    // Заглушка для GET-запросов (проверка доступности)
    if (req.method === 'GET') {
      return res.status(200).send('Telegram Bot Webhook is active!');
    }
    
    // Проверка, существует ли тело запроса
    if (!req.body) {
      console.log('Тело запроса отсутствует');
      return res.status(200).send('OK but no request body');
    }
    
    console.log('Получен запрос webhook');
    
    // Обрабатываем обновление от Telegram
    await bot.handleUpdate(req.body);
    
    // Отвечаем с успешным статусом
    console.log('Запрос успешно обработан');
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке webhook:', error);
    return res.status(500).send('Internal Server Error: ' + error.message);
  }
};