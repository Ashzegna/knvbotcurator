// Импортируем необходимые библиотеки
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const NodeCache = require('node-cache');
const moment = require('moment');

// Импортируем модули для работы с администраторами
const { forwardRequestToAdminWithDirectLink, createDirectChatLink } = require('./admin_direct_message');
const initAdminCommands = require('./admin_commands');

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

// Инициализируем команды администратора
const adminCommandsHelpers = initAdminCommands(bot);

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
        `/direct ID_ПОЛЬЗОВАТЕЛЯ - Получить ссылку для прямого чата в Telegram (***РЕКОМЕНДУЕТСЯ***)\n` +
        `/dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ - Отправить сообщение пользователю через бота\n` +
        `/users - Показать список последних активных пользователей\n` +
        `/reset - Сбросить текущее состояние\n\n` +
        `🔥 Новая функциональность - прямое общение с пользующимися через Ваш личный аккаунт:\n\n` +
        `При получении нового вопроса от пользователя, вы можете:\n` +
        `1. Нажать на кнопку "Написать напрямую" для прямого чата в Telegram\n` +
        `2. Использовать команду /direct ID_ПОЛЬЗОВАТЕЛЯ для получения ссылки на прямой чат\n` +
        `3. Писать ответ через бота с помощью кнопки "Ответить через бота"\n\n` +
        `Примечание: при общении через прямой чат, Вы будете видны пользователю как свой личный аккаунт Telegram.`;
      
      await ctx.reply(adminHelp, { disable_web_page_preview: true });
      
      // Добавляем кнопку для просмотра последних пользователей
      await ctx.reply('Быстрые команды:', Markup.inlineKeyboard([
        [Markup.button.callback('👤 Последние пользователи', 'admin_show_users')]
      ]));
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

// Обработчик для кнопки "Последние пользователи"
bot.action('admin_show_users', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.answerCbQuery('Эта функция доступна только администратору');
      return;
    }
    
    await ctx.answerCbQuery();
    
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
      .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
      .slice(0, 5); // Берем только 5 последних пользователей
    
    if (userList.length === 0) {
      await ctx.reply('Нет активных пользователей в последнее время.');
      return;
    }
    
    // Создаем улучшенные кнопки для прямого диалога с пользователями
    const buttons = [];
    
    userList.forEach(user => {
      const date = new Date(user.lastActivity || Date.now()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      // Добавляем строку с информацией о пользователе
      buttons.push([
        Markup.button.url(`📱 ${user.username} (${date})`, `tg://user?id=${user.userId}`)
      ]);
    });
    
    // Добавляем кнопку получения полного списка
    buttons.push([Markup.button.callback('📝 Полный список пользователей', 'admin_full_users_list')]);
    
    await ctx.reply('Последние активные пользователи (нажмите на кнопку, чтобы открыть прямой диалог):', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
    await ctx.answerCbQuery('Произошла ошибка при получении списка пользователей');
    await ctx.reply('Произошла ошибка при получении списка пользователей. Попробуйте команду /users');
  }
});

// Обработчик для кнопки "Полный список пользователей"
bot.action('admin_full_users_list', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.answerCbQuery('Эта функция доступна только администратору');
      return;
    }
    
    await ctx.answerCbQuery();
    
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
      .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
    
    if (userList.length === 0) {
      await ctx.reply('Нет активных пользователей в последнее время.');
      return;
    }
    
    // Формируем сообщение со списком пользователей
    let message = '📃 Список всех пользователей (отсортировано по последней активности):\n\n';
    
    userList.forEach((user, index) => {
      const date = new Date(user.lastActivity || Date.now()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      message += `${index + 1}. ${user.username} (ID: ${user.userId}) - ${date}\n`;
      message += `   ➡️ /direct ${user.userId} - открыть прямой чат\n`;
    });
    
    message += '\n💬 Для отправки сообщения с помощью бота используйте команду /dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ';
    
    await ctx.reply(message);
    
    // Создаем кнопки для первых 5 пользователей
    const topUsers = userList.slice(0, 5);
    const buttons = topUsers.map(user => [
      Markup.button.url(`💬 ${user.username}`, `tg://user?id=${user.userId}`)
    ]);
    
    await ctx.reply('Быстрый доступ к последним пользователям:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Ошибка при получении полного списка пользователей:', error);
    await ctx.answerCbQuery('Произошла ошибка при получении списка');
    await ctx.reply('Произошла ошибка при получении списка пользователей.');
  }
});

// Обработчик для кнопки "Последние пользователи"
bot.action('admin_show_users', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.answerCbQuery('Эта функция доступна только администратору');
      return;
    }
    
    await ctx.answerCbQuery();
    
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
      .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
      .slice(0, 5); // Берем только 5 последних пользователей
    
    if (userList.length === 0) {
      await ctx.reply('Нет активных пользователей в последнее время.');
      return;
    }
    
    // Создаем кнопки для прямого диалога с пользователями
    const buttons = userList.map(user => {
      const date = new Date(user.lastActivity || Date.now()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return [Markup.button.url(
        `${user.username} (ID: ${user.userId}) - ${date}`,
        `tg://user?id=${user.userId}`
      )];
    });
    
    // Добавляем кнопку получения полного списка
    buttons.push([Markup.button.callback('📝 Полный список пользователей', 'admin_full_users_list')]);
    
    await ctx.reply('Последние активные пользователи (нажмите, чтобы начать чат):', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
    await ctx.answerCbQuery('Произошла ошибка при получении списка пользователей');
    await ctx.reply('Произошла ошибка при получении списка пользователей. Попробуйте команду /users');
  }
});

// Обработчик для кнопки "Полный список пользователей"
bot.action('admin_full_users_list', async (ctx) => {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (!isAdmin) {
      await ctx.answerCbQuery('Эта функция доступна только администратору');
      return;
    }
    
    await ctx.answerCbQuery();
    
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
      .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
    
    if (userList.length === 0) {
      await ctx.reply('Нет активных пользователей в последнее время.');
      return;
    }
    
    // Формируем сообщение со списком пользователей
    let message = '📃 Список всех пользователей (отсортировано по последней активности):\n\n';
    
    userList.forEach((user, index) => {
      const date = new Date(user.lastActivity || Date.now()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      message += `${index + 1}. ${user.username} (ID: ${user.userId}) - ${date}\n`;
      message += `   \u27a1\ufe0f /direct ${user.userId} - открыть прямой чат\n`;
    });
    
    message += '\n💬 Для отправки сообщения с помощью бота используйте команду /dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ';
    
    await ctx.reply(message);
    
    // Создаем кнопки для первых 5 пользователей
    const topUsers = userList.slice(0, 5);
    const buttons = topUsers.map(user => [
      Markup.button.url(`💬 ${user.username}`, `tg://user?id=${user.userId}`)
    ]);
    
    await ctx.reply('Быстрый доступ к последним пользователям:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Ошибка при получении полного списка пользователей:', error);
    await ctx.answerCbQuery('Произошла ошибка при получении списка');
    await ctx.reply('Произошла ошибка при получении списка пользователей.');
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
    
    // Получаем ссылки для прямого диалога из модуля
    const linkData = createDirectChatLink(targetUserId);
    
    // Отправляем расширенное сообщение с вариантами ссылок
    await ctx.reply(linkData.instructions, Markup.inlineKeyboard([
      [Markup.button.url(`📱 Открыть диалог с пользователем`, linkData.directLink)],
      [Markup.button.url(`🌐 Альтернативная ссылка (web)`, linkData.alternativeLink)]
    ]));
    
    // Отправляем дополнительную информацию о получении сообщений
    await ctx.reply('💡 Советы по прямому общению:\n\n' +
    '• Представьтесь пользователю при первом контакте\n' +
    '• Упомяните, что Вы куратор и отвечаете по вопросу из бота\n' +
    '• Если диалог не открывается через первую кнопку, попробуйте альтернативную ссылку');
    
  } catch (error) {
    console.error('Ошибка в обработчике команды /direct:', error);
    await ctx.reply('Произошла ошибка при создании ссылки. Пожалуйста, повторите попытку позже.');
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
          userId: request.userId,
          category: request.category || 'unknown',
          lastMessage: request.text || ''
        });
      }
    });
    
    // Преобразуем в массив и сортируем по последней активности
    const userList = Array.from(users.values())
      .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
      .slice(0, 10); // Берем только 10 последних пользователей
    
    if (userList.length === 0) {
      await ctx.reply('Список пользователей пуст.');
      return;
    }
    
    // Формируем улучшенное сообщение со списком пользователей
    let message = '📊 Последние активные пользователи:\n\n';
    userList.forEach((user, index) => {
      const date = new Date(user.lastActivity || Date.now()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      message += `${index + 1}. ${user.username} (ID: ${user.userId}) - ${date}\n`;
      message += `   📱 /direct ${user.userId} - открыть прямой диалог\n`;
      
      // Добавляем краткую информацию о последнем сообщении, если оно есть
      if (user.lastMessage) {
        const shortMessage = user.lastMessage.length > 50 ? 
          user.lastMessage.substring(0, 50) + '...' : 
          user.lastMessage;
        message += `   💬 Последний вопрос: ${shortMessage}\n`;
      }
      
      message += '\n';
    });
    
    message += '📲 Команды для связи с пользователями:\n' +
               '/direct ID - открыть прямой диалог через Telegram\n' +
               '/dm ID ТЕКСТ - отправить сообщение через бота';
    
    await ctx.reply(message);
    
    // Создаем интерактивную клавиатуру для быстрого доступа
    const buttons = [];
    
    // Добавляем кнопки для топ-5 пользователей
    const topUsers = userList.slice(0, 5);
    topUsers.forEach(user => {
      buttons.push([
        Markup.button.url(`📱 Открыть диалог с ${user.username}`, `tg://user?id=${user.userId}`)
      ]);
    });
    
    // Добавляем кнопку помощи
    buttons.push([Markup.button.callback('❓ Помощь по командам', 'admin_commands_help')]);
    
    await ctx.reply(
      '⚡ Быстрый доступ к диалогам с пользователями:',
      Markup.inlineKeyboard(buttons)
    );
  } catch (error) {
    console.error('Ошибка в обработчике команды /users:', error);
    await ctx.reply('Произошла ошибка при получении списка пользователей.');
  }
});

// Команда для получения ссылки на прямой чат с пользователем
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
    
    // Предлагаем два варианта: ответить через бота или напрямую
    const userInfo = `Запрос #${requestId} от пользователя ${requestData.username}:\n\n${requestData.text}`;
    
    await ctx.reply(userInfo, Markup.inlineKeyboard([
      [Markup.button.url('📱 Открыть прямой диалог', `tg://user?id=${requestData.userId}`)],
      [Markup.button.callback('✏️ Продолжить ответ через бота', `continue_reply_${requestId}`)],
      [Markup.button.callback('❌ Отменить ответ', `cancel_reply_${requestId}`)]
    ]));
    
  } catch (error) {
    console.error('Ошибка при обработке нажатия на кнопку "Ответить на запрос":', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка нажатия на кнопку "Продолжить ответ через бота"
bot.action(/continue_reply_(.+)/, async (ctx) => {
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
    await ctx.reply(`Введите ваш ответ на запрос #${requestId}. Ответ будет отправлен пользователю ${requestData.username} от имени бота.`);
  } catch (error) {
    console.error('Ошибка при обработке продолжения ответа:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка нажатия на кнопку "Отменить ответ"
bot.action(/cancel_reply_(.+)/, async (ctx) => {
  try {
    const requestId = ctx.match[1];
    const adminId = ctx.from.id;
    
    // Сбрасываем состояние администратора
    cache.set(`admin_${adminId}_state`, null);
    cache.set(`admin_${adminId}_current_request`, null);
    
    await ctx.answerCbQuery('Ответ отменен');
    await ctx.reply('Ответ отменен. Вы можете вернуться к этому запросу позже.');
  } catch (error) {
    console.error('Ошибка при отмене ответа:', error);
    await ctx.answerCbQuery('Произошла ошибка при отмене ответа');
  }
});

// Функция для пересылки запроса администратору/куратору
async function forwardRequestToAdmin(requestData, ctx) {
  try {
    // Используем модульную функцию для пересылки запроса администратору
    await forwardRequestToAdminWithDirectLink(bot, requestData, ctx, QUESTION_CATEGORIES, cache, REQUEST_STATUS);
    
    // Логируем успешную отправку запроса для мониторинга
    console.log(`Запрос #${requestData.id} от пользователя ${requestData.username} успешно отправлен администратору`);
    
    // Сохраняем время последней активности пользователя
    requestData.lastActivity = Date.now();
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
      
      // Отправляем более информативное приветствие администратору
      await bot.telegram.sendMessage(adminChatId, `Привет! Я бот КурсНова для связи с куратором.

🔥 УЛУЧШЕНИЕ: Теперь Вы можете напрямую связываться с пользователями через Ваш личный Telegram аккаунт.

При получении вопроса от пользователя, вы увидите кнопку "Написать напрямую".

Подробнее о новых возможностях можно узнать в /help`);
      
      
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
    
    const message = `✅ Бот КурсНова успешно запущен: ${new Date().toLocaleString()}

Новые функции бота:
• Прямая связь с пользователями через Ваш личный аккаунт
• Улучшенный интерфейс для работы с вопросами
• Быстрый доступ к активным пользователям

Чтобы подтвердить работоспособность, нажмите:`;
    
    const result = await bot.telegram.sendMessage(adminChatId, message, Markup.inlineKeyboard([
      [Markup.button.callback('✨ Подтвердить и открыть справку', 'confirm_functionality')]
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
    
    // Отправляем информативное сообщение о новых возможностях
    await ctx.reply(`🔔 Система связи с куратором успешно активирована 

🆕 НОВЫЕ ВОЗМОЖНОСТИ БОТА:

1. Прямое общение с пользователями
   Теперь Вы можете напрямую общаться с пользователями через Ваш личный Telegram аккаунт.

2. Улучшенный интерфейс для доступа к пользователям
   Для просмотра списка активных пользователей используйте команду /users

3. Прямые ссылки на пользователей
   Для прямого чата с конкретным пользователем используйте /direct ID_ПОЛЬЗОВАТЕЛЯ

Подробная справка по всем командам: /help`);
    
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