// Импортируем необходимые библиотеки
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const NodeCache = require('node-cache');
const moment = require('moment');

// Проверка наличия BOT_TOKEN
if (!process.env.BOT_TOKEN) {
  console.error('Критическая ошибка: BOT_TOKEN не найден в переменных окружения!');
  process.exit(1);
}

// Печатаем все переменные окружения для диагностики (без токена)
console.log('Настройки окружения:', {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
  CURATOR_RESPONSE_TIMEOUT: process.env.CURATOR_RESPONSE_TIMEOUT,
  BOT_TOKEN_EXISTS: !!process.env.BOT_TOKEN
});

// Инициализация бота с жесткой проверкой токена
const botToken = process.env.BOT_TOKEN || '';
const bot = new Telegraf(botToken);

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

// Обработка команды /help
bot.help(async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    
    console.log(`Получена команда /help от пользователя ${userId}`);
    
    // Проверяем, является ли пользователь администратором
    if (userId.toString() === adminChatId.toString()) {
      // Справка для администратора
      const adminHelp = `Справка по работе с ботом (для куратора):\n\n` +
        `/start - Начать работу с ботом\n` +
        `/help - Показать эту справку\n` +
        `/dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ - Отправить сообщение пользователю через бота\n` +
        `/direct ID_ПОЛЬЗОВАТЕЛЯ - Получить ссылку для прямого чата в Telegram\n` +
        `/users - Показать список последних активных пользователей\n` +
        `/reset - Сбросить текущее состояние\n\n` +
        `При получении нового вопроса от пользователя, вы можете:\n` +
        `1. Ответить через кнопку "Ответить на запрос"\n` +
        `2. Отправить сообщение через бота с помощью команды /dm\n` +
        `3. Начать прямой диалог в Telegram, нажав на кнопку "Написать напрямую"`;
      
      await ctx.reply(adminHelp);
      return;
    }
    
    // Справка для обычного пользователя
    const userHelp = `Справка по работе с ботом:\n\n` +
      `/start - Начать работу с ботом\n` +
      `/help - Показать эту справку\n\n` +
      `Чтобы задать вопрос, нажмите кнопку "❓ Задать вопрос" в меню.\n` +
      `Ваш вопрос будет передан куратору, который ответит вам в ближайшее время.`;
    
    await ctx.reply(userHelp);
  } catch (error) {
    console.error('Ошибка в обработчике команды /help:', error);
    await ctx.reply('Произошла ошибка при показе справки.');
  }
});

// Команда для отправки сообщения конкретному пользователю
bot.command('dm', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.reply('Эта команда доступна только администратору.');
      return;
    }
    
    // Парсим команду, формат: /dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ_СООБЩЕНИЯ
    const text = ctx.message.text;
    const match = text.match(/^\/dm\s+(\d+)\s+(.+)$/);
    
    if (!match) {
      await ctx.reply('Неверный формат команды. Используйте: /dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ_СООБЩЕНИЯ');
      return;
    }
    
    const targetUserId = match[1];
    const messageText = match[2];
    
    // Отправляем сообщение пользователю
    try {
      await bot.telegram.sendMessage(targetUserId, `Сообщение от куратора:\n\n${messageText}`);
      await ctx.reply(`✅ Сообщение успешно отправлено пользователю ${targetUserId}`);
      console.log(`Администратор ${userId} отправил прямое сообщение пользователю ${targetUserId}`);
    } catch (error) {
      console.error('Ошибка при отправке сообщения пользователю:', error);
      await ctx.reply(`❌ Не удалось отправить сообщение пользователю ${targetUserId}. Возможно, пользователь заблокировал бота или указан неверный ID.`);
    }
  } catch (error) {
    console.error('Ошибка в обработчике команды /dm:', error);
    await ctx.reply('Произошла ошибка при отправке сообщения.');
  }
});

// Команда для получения ссылки на пользователя
bot.command('direct', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.reply('Эта команда доступна только администратору.');
      return;
    }
    
    // Парсим команду, формат: /direct ID_ПОЛЬЗОВАТЕЛЯ
    const text = ctx.message.text;
    const match = text.match(/^\/direct\s+(\d+)/);
    
    if (!match) {
      await ctx.reply('Неверный формат команды. Используйте: /direct ID_ПОЛЬЗОВАТЕЛЯ');
      return;
    }
    
    const targetUserId = match[1];
    
    // Создаем ссылку и отправляем ее администратору
    const instructions = `Чтобы начать прямой диалог с пользователем (ID: ${targetUserId}), нажмите на кнопку ниже:

ℹ️ Важные примечания:
• При нажатии на кнопку откроется чат с пользователем в Telegram (не через бота)
• Вы будете общаться от вашего личного аккаунта Telegram
• Сообщения в прямом чате не проходят через систему бота`;

    await ctx.reply(instructions, Markup.inlineKeyboard([
      [Markup.button.url(`💬 Написать напрямую`, `tg://user?id=${targetUserId}`)]
    ]));
  } catch (error) {
    console.error('Ошибка в обработчике команды /direct:', error);
    await ctx.reply('Произошла ошибка при создании ссылки.');
  }
});

// Команда для просмотра последних пользователей
bot.command('users', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.reply('Эта команда доступна только администратору.');
      return;
    }
    
    // Получаем все запросы из кэша
    const keys = cache.keys();
    const requestKeys = keys.filter(key => key.startsWith('request_'));
    
    // Собираем информацию о пользователях
    const users = new Map();
    requestKeys.forEach(key => {
      const request = cache.get(key);
      if (request && request.userId) {
        users.set(request.userId, {
          username: request.username,
          lastActivity: request.lastActivity || request.created,
          userId: request.userId
        });
      }
    });
    
    // Преобразуем в массив и сортируем по последней активности
    const userList = Array.from(users.values())
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, 10); // Берем только 10 последних пользователей
    
    if (userList.length === 0) {
      await ctx.reply('Список пользователей пуст.');
      return;
    }
    
    // Формируем сообщение со списком пользователей
    let message = '📊 Последние пользователи:\n\n';
    userList.forEach((user, index) => {
      const date = new Date(user.lastActivity).toLocaleString();
      message += `${index + 1}. ${user.username} (ID: ${user.userId}) - ${date}\n`;
    });
    
    message += '\n💬 Для отправки сообщения используйте:\n/dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ_СООБЩЕНИЯ\n/direct ID_ПОЛЬЗОВАТЕЛЯ - для прямого чата через Telegram';
    
    await ctx.reply(message);
    
    // Создаем кнопки для прямого диалога с пользователями
    // Максимум 5 кнопок для последних пользователей
    const topUsers = userList.slice(0, 5);
    
    const buttons = topUsers.map(user => {
      return [Markup.button.url(
        `💬 ${user.username} (ID: ${user.userId})`, 
        `tg://user?id=${user.userId}`
      )];
    });
    
    await ctx.reply(
      'Прямые ссылки на чат с последними пользователями:',
      Markup.inlineKeyboard(buttons)
    );
  } catch (error) {
    console.error('Ошибка в обработчике команды /users:', error);
    await ctx.reply('Произошла ошибка при получении списка пользователей.');
  }
});

// Команда для сброса состояния администратора
bot.command('reset', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.reply('Эта команда доступна только администратору.');
      return;
    }
    
    // Сбрасываем состояние администратора
    cache.set(`admin_${userId}_state`, null);
    cache.set(`admin_${userId}_current_request`, null);
    
    await ctx.reply('Состояние сброшено. Теперь вы можете начать отвечать на новые запросы.');
  } catch (error) {
    console.error('Ошибка в обработчике команды /reset:', error);
    await ctx.reply('Произошла ошибка при сбросе состояния.');
  }
});

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

// Обработчики категорий вопросов
bot.action(/question_(.+)/, async (ctx) => {
  try {
    const category = ctx.match[1];
    
    // Сохраняем выбранную категорию в данные пользователя
    cache.set(`user_${ctx.from.id}_category`, category);
    
    await ctx.answerCbQuery();
    
    let categoryName = 'вопроса';
    switch (category) {
      case 'homework':
        categoryName = 'вопроса по домашней работе';
        break;
      case 'app':
        categoryName = 'вопроса по приложению';
        break;
      case 'technical':
        categoryName = 'технического вопроса';
        break;
      case 'other':
        categoryName = 'другого вопроса';
        break;
    }
    
    await ctx.reply(`Пожалуйста, опишите детали вашего ${categoryName}. Чем подробнее, тем лучше!`);
    
    // Устанавливаем состояние "ожидание вопроса"
    cache.set(`user_${ctx.from.id}_state`, 'waiting_question');
  } catch (error) {
    console.error('Ошибка при обработке выбора категории:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка текстовых сообщений (вопросы пользователей)
bot.on('text', async (ctx) => {
  try {
    const userState = cache.get(`user_${ctx.from.id}_state`);
    const adminState = cache.get(`admin_${ctx.from.id}_state`);
    
    // Для администраторов (обработка ответов)
    if (adminState === 'waiting_reply') {
      try {
        const requestId = cache.get(`admin_${ctx.from.id}_current_request`);
        
        if (!requestId) {
          await ctx.reply('Ошибка: запрос не найден. Пожалуйста, начните сначала.');
          cache.set(`admin_${ctx.from.id}_state`, null);
          return;
        }
        
        const requestData = cache.get(`request_${requestId}`);
        
        if (!requestData) {
          await ctx.reply('Ошибка: запрос не найден или устарел. Пожалуйста, начните сначала.');
          cache.set(`admin_${ctx.from.id}_state`, null);
          return;
        }
        
        const replyText = ctx.message.text;
        
        // Отправляем ответ пользователю
        await bot.telegram.sendMessage(
          requestData.userId,
          `Ответ на ваш вопрос:\n\n${replyText}`
        );
        
        // Обновляем статус запроса
        requestData.status = REQUEST_STATUS.ANSWERED;
        requestData.answerText = replyText;
        requestData.answeredBy = ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim();
        requestData.answeredAt = Date.now();
        
        cache.set(`request_${requestId}`, requestData);
        
        // Сбрасываем состояние администратора
        cache.set(`admin_${ctx.from.id}_state`, null);
        cache.set(`admin_${ctx.from.id}_current_request`, null);
        
        await ctx.reply(`Ответ на запрос #${requestId} успешно отправлен пользователю ${requestData.username}.`);
      } catch (error) {
        console.error('Ошибка при обработке ответа от администратора:', error);
        await ctx.reply('Произошла ошибка при отправке ответа. Пожалуйста, повторите попытку позже.');
        
        // Сбрасываем состояние администратора при ошибке
        cache.set(`admin_${ctx.from.id}_state`, null);
      }
      return; // Важно добавить return, чтобы не срабатывало общее меню ниже
    }
    
    // Если пользователь в режиме ввода вопроса
    if (userState === 'waiting_question') {
      const questionText = ctx.message.text;
      const questionCategory = cache.get(`user_${ctx.from.id}_category`) || QUESTION_CATEGORIES.OTHER;
      
      // Генерируем уникальный ID для запроса
      const requestId = `req_${Date.now()}_${ctx.from.id}`;
      
      // Сохраняем запрос в кэше
      const requestData = {
        id: requestId,
        userId: ctx.from.id,
        username: ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim(),
        category: questionCategory,
        text: questionText,
        status: REQUEST_STATUS.NEW,
        created: Date.now(),
        lastActivity: Date.now()
      };
      
      cache.set(`request_${requestId}`, requestData);
      
      // Добавляем запрос в список запросов пользователя
      let userRequests = cache.get(`user_${ctx.from.id}_requests`) || [];
      userRequests.push(requestId);
      cache.set(`user_${ctx.from.id}_requests`, userRequests);
      
      // Отправляем подтверждение пользователю
      await ctx.reply('Спасибо за ваш вопрос! Ваше обращение зарегистрировано и передано нашему куратору. Мы ответим вам в ближайшее время.');
      
      // Сбрасываем состояние пользователя
      cache.set(`user_${ctx.from.id}_state`, null);
      
      // Отправляем запрос администратору/куратору
      await forwardRequestToAdmin(requestData, ctx);
      
      // Устанавливаем таймер для проверки ответа
      setTimeout(() => checkRequestStatus(requestId, ctx), process.env.CURATOR_RESPONSE_TIMEOUT * 60 * 1000);
      return;
    }
    
    // Если не в режиме вопроса, предлагаем меню
    await ctx.reply('Чем я могу вам помочь?', Markup.keyboard([
      ['❓ Задать вопрос'],
      ['📚 Частые вопросы', '📞 Связаться с командой']
    ]).resize());
  } catch (error) {
    console.error('Ошибка при обработке текстового сообщения:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка нажатия на кнопку "Ответить на запрос"
bot.action(/reply_(.+)/, async (ctx) => {
  try {
    const requestId = ctx.match[1];
    const adminId = ctx.from.id;
    const requestData = cache.get(`request_${requestId}`);
    
    if (!requestData) {
      await ctx.answerCbQuery('Запрос не найден или устарел');
      return;
    }
    
    // Сохраняем ID администратора, который ответит на запрос
    cache.set(`admin_${adminId}_current_request`, requestId);
    
    // Устанавливаем состояние "ожидание ответа от админа"
    cache.set(`admin_${adminId}_state`, 'waiting_reply');
    
    await ctx.answerCbQuery();
    await ctx.reply(`Введите ваш ответ на запрос #${requestId} от пользователя ${requestData.username}:\n\n${requestData.text}`);
  } catch (error) {
    console.error('Ошибка при обработке нажатия на кнопку "Ответить на запрос":', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Функция для пересылки запроса администратору/куратору
async function forwardRequestToAdmin(requestData, ctx) {
  try {
    // Используем ID куратора из переменных окружения
    const adminChatId = process.env.ADMIN_CHAT_ID; // ID куратора из .env
    
    console.log(`Отправляю запрос куратору с ID: ${adminChatId}`);
    
    // Формируем сообщение для админа
    let categoryText = 'Другое';
    switch (requestData.category) {
      case QUESTION_CATEGORIES.HOMEWORK:
        categoryText = 'Вопрос по домашней работе';
        break;
      case QUESTION_CATEGORIES.APP:
        categoryText = 'Вопрос по приложению';
        break;
      case QUESTION_CATEGORIES.TECHNICAL:
        categoryText = 'Технический вопрос';
        break;
    }
    
    const adminMessage = `
📩 Новый запрос #${requestData.id}

👤 Пользователь: ${requestData.username} (ID: ${requestData.userId})
📂 Категория: ${categoryText}
⏱ Время: ${moment(requestData.created).format('DD.MM.YYYY HH:mm:ss')}

📌 Текст запроса:
${requestData.text}

💬 Чтобы ответить напрямую:
• Через команду: /dm ${requestData.userId} Ваш ответ
• Напрямую: [Открыть чат с пользователем](tg://user?id=${requestData.userId})
`;
    
    // Попытка прямой отправки сообщения куратору
    try {
      // Отправляем сообщение администратору с кнопками для ответа
      await bot.telegram.sendMessage(adminChatId, adminMessage, Markup.inlineKeyboard([
        [Markup.button.callback(`✏️ Ответить на запрос #${requestData.id}`, `reply_${requestData.id}`)],
        [Markup.button.url(`💬 Прямой чат с пользователем`, `tg://user?id=${requestData.userId}`)],
        [Markup.button.callback(`🔄 Изменить категорию`, `change_category_${requestData.id}`)]
      ]));
      
      console.log(`Сообщение успешно отправлено куратору ${adminChatId}`);
    } catch (sendError) {
      console.error(`Ошибка при отправке сообщения куратору:`, sendError);
      
      // Дополнительная попытка отправить простое сообщение без кнопок
      try {
        await bot.telegram.sendMessage(adminChatId, adminMessage);
        console.log(`Отправлено упрощенное сообщение куратору ${adminChatId}`);
      } catch (simpleSendError) {
        console.error(`Не удалось отправить даже простое сообщение:`, simpleSendError);
      }
    }
    
    // Обновляем статус запроса
    requestData.status = REQUEST_STATUS.WAITING;
    cache.set(`request_${requestData.id}`, requestData);
    
  } catch (error) {
    console.error('Ошибка при пересылке запроса администратору:', error);
    throw error;
  }
}

// Функция для проверки статуса запроса после таймаута
async function checkRequestStatus(requestId, ctx) {
  try {
    const requestData = cache.get(`request_${requestId}`);
    
    if (requestData && requestData.status === REQUEST_STATUS.WAITING) {
      // Если запрос все еще в ожидании ответа
      requestData.status = REQUEST_STATUS.TIMEOUT;
      cache.set(`request_${requestId}`, requestData);
      
      // Отправляем уведомление пользователю
      await bot.telegram.sendMessage(
        requestData.userId,
        'Прости, нас завалило вопросами. Разбираемся в порядке очередности. Обязательно ответим в течение часа, но постараемся раньше 👍'
      );
      
      // Отправляем напоминание администратору
      const adminChatId = process.env.ADMIN_CHAT_ID; // ID куратора из .env
      await bot.telegram.sendMessage(
        adminChatId,
        `⚠️ Напоминание: запрос #${requestId} от пользователя ${requestData.username} ожидает ответа уже более ${process.env.CURATOR_RESPONSE_TIMEOUT} минут!`,
        Markup.inlineKeyboard([
          [Markup.button.callback(`✏️ Ответить на запрос #${requestId}`, `reply_${requestId}`)],
          [Markup.button.url(`💬 Написать напрямую`, `tg://user?id=${requestData.userId}`)]
        ])
      );
    }
  } catch (error) {
    console.error('Ошибка при проверке статуса запроса:', error);
  }
}

// Обработчик для прямого сообщения из напоминания
bot.action(/direct_message_(\d+)/, async (ctx) => {
  try {
    const targetUserId = ctx.match[1];
    const adminId = ctx.from.id;
    
    // Устанавливаем состояние для отправки прямого сообщения
    cache.set(`admin_${adminId}_direct_message_target`, targetUserId);
    cache.set(`admin_${adminId}_state`, 'waiting_direct_message');
    
    await ctx.answerCbQuery();
    await ctx.reply(`Введите сообщение для отправки пользователю с ID ${targetUserId}:`);
  } catch (error) {
    console.error('Ошибка при подготовке к отправке прямого сообщения:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, используйте команду /dm.');
  }
});

// Функция для инициализации диалога с куратором
async function initCuratorChat() {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    console.log(`Попытка инициализации диалога с куратором (ID: ${adminChatId})`);
    
    // Попытка отправить приветственное сообщение
    try {
      // Получаем информацию о боте
      const botInfo = await bot.telegram.getMe();
      console.log(`Информация о боте:`, botInfo);
      
      // Отправляем напоминание администратору при запуске бота
      await bot.telegram.sendMessage(adminChatId, `Привет, я бот КурсНова. Проверяю связь с вами.

Новые функции:
- Для начала прямого чата с пользователем используйте кнопку "Написать напрямую"
- /direct ID_ПОЛЬЗОВАТЕЛЯ - получить ссылку для прямого чата`);
      
      console.log('Приветственное сообщение успешно отправлено');
    } catch (initError) {
      console.error('Ошибка при инициализации диалога:', initError);
    }
    
    // Небольшая пауза перед отправкой основного сообщения
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    console.error('Ошибка при инициализации чата с куратором:', error);
    console.error('Подробности ошибки:', JSON.stringify(error));
    return false;
  }
}

// Функция для отправки тестового сообщения при запуске
async function sendTestMessageToAdmin() {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    console.log(`Отправка тестового сообщения куратору (ID: ${adminChatId})`);
    
    const message = `Тестовое сообщение: Бот КурсНова успешно запущен в ${new Date().toLocaleString()}.

Если вы получили это сообщение, значит связь с ботом работает корректно.

Для проверки работоспособности системы, пожалуйста, нажмите на кнопку ниже:`;
    
    const result = await bot.telegram.sendMessage(adminChatId, message, Markup.inlineKeyboard([
      [Markup.button.callback('✅ Подтвердить работоспособность', 'confirm_functionality')]
    ]));
    
    console.log('Тестовое сообщение успешно отправлено:', result);
    return true;
  } catch (error) {
    console.error('Ошибка при отправке тестового сообщения:', error);
    console.error('Подробности ошибки:', JSON.stringify(error));
    return false;
  }
}

// Обработчик подтверждения работоспособности
bot.action('confirm_functionality', async (ctx) => {
  try {
    await ctx.answerCbQuery('Спасибо за подтверждение!');
    await ctx.reply('Отлично! Система связи с куратором работает корректно. 

Новые функции:
1. Кнопка "Написать напрямую" - начать прямой чат в Telegram
2. Команда /direct ID_ПОЛЬЗОВАТЕЛЯ - получить ссылку для прямого чата

Больше информации - команда /help');
    console.log('Куратор подтвердил работоспособность системы');
  } catch (error) {
    console.error('Ошибка при обработке подтверждения:', error);
  }
});

// Запуск бота
if (process.env.NODE_ENV === 'production') {
  // Для Vercel и других serverless платформ используем webhook
  module.exports = async (req, res) => {
    try {
      // Заглушка для GET-запросов (проверка доступности)
      if (req.method === 'GET') {
        return res.status(200).send('Telegram Bot is running!');
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
} else {
  // Для локальной разработки используем long polling
  bot.launch()
    .then(async () => {
      console.log('Бот КурсНова: чат с куратором запущен в режиме long polling');
      
      // Инициализируем диалог с куратором
      const initResult = await initCuratorChat();
      if (initResult) {
        console.log('Диалог с куратором успешно инициализирован');
      } else {
        console.log('Проблема при инициализации диалога с куратором');
      }
      
      // Небольшая пауза перед отправкой тестового сообщения
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Отправляем тестовое сообщение куратору
      const testResult = await sendTestMessageToAdmin();
      if (testResult) {
        console.log('Тестовое сообщение куратору успешно отправлено');
      } else {
        console.log('Ошибка при отправке тестового сообщения куратору. Проверьте ADMIN_CHAT_ID в файле .env');
      }
      
      // Запускаем периодическую проверку и отправку запросов из очереди
      // Проверка каждые 2 минуты
      setInterval(async () => {
        console.log('Запуск плановой обработки очереди запросов...');
        // Здесь может быть функция обработки очереди, если потребуется
      }, 2 * 60 * 1000); // 2 минуты
    })
    .catch(err => {
      console.error('Ошибка при запуске бота:', err);
    });
  
  // Корректное завершение работы при остановке приложения
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}