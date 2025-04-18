// Команды для администраторов
const { Markup } = require('telegraf');
const NodeCache = require('node-cache');
const moment = require('moment');

// Инициализация кэша для хранения данных
const cache = new NodeCache({ stdTTL: 86400 }); // хранение данных в течение 24 часов

/**
 * Инициализация команд администратора
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function initAdminCommands(bot) {

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
        await ctx.reply('Неверный формат команды. Используйте: /dm ID ТЕКСТ', Markup.inlineKeyboard([
          [Markup.button.callback('💻 Показать список пользователей', 'admin_show_users')]
        ]));
        return;
      }
      
      const targetUserId = match[1];
      const messageText = match[2];
      
      // Получаем информацию о пользователе из кэша
      let username = 'пользователь';
      const keys = cache.keys();
      const requestKeys = keys.filter(key => key.startsWith('request_'));
      
      for (const key of requestKeys) {
        const request = cache.get(key);
        if (request && request.userId == targetUserId) {
          username = request.username || username;
          break;
        }
      }
      
      // Отправляем сообщение пользователю
      try {
        await bot.telegram.sendMessage(targetUserId, `Сообщение от куратора:\n\n${messageText}`);
        await ctx.reply(`✅ Сообщение успешно отправлено пользователю ${username} (ID: ${targetUserId})`, Markup.inlineKeyboard([
          [Markup.button.url('📱 Открыть прямой диалог', `tg://user?id=${targetUserId}`)]          
        ]));

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

  // Расширенные команды для администратора
  
  // Обработчик команды /help для администратора
  bot.help(async (ctx) => {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const isAdmin = userId.toString() === adminChatId.toString();
    
    if (isAdmin) {
      // Расширенная справка для администратора
      await ctx.reply(adminHelpText);
      
      // Добавляем кнопки быстрого доступа
      await ctx.reply('Быстрые команды:', Markup.inlineKeyboard([
        [Markup.button.callback('👤 Активные пользователи', 'admin_show_users')],
        [Markup.button.callback('📝 Частые команды', 'admin_quick_commands')]
      ]));
      return;
    }
    
    // Обычная справка для пользователей
    await ctx.reply('Справка по работе с ботом:\n\n' +
                   '/start - Начать работу с ботом\n' +
                   '/help - Показать эту справку\n\n' +
                   'Чтобы задать вопрос, нажмите кнопку "❓ Задать вопрос" в меню.');
  });

  // Новая команда для быстрого доступа к частым командам
  bot.action('admin_quick_commands', async (ctx) => {
    try {
      const adminChatId = process.env.ADMIN_CHAT_ID;
      const userId = ctx.from.id;
      const isAdmin = userId.toString() === adminChatId.toString();
      
      if (!isAdmin) {
        await ctx.answerCbQuery('Эта функция доступна только администратору');
        return;
      }
      
      await ctx.answerCbQuery();
      
      // Создаем клавиатуру с частыми командами
      await ctx.reply('Частые команды для администратора:', Markup.inlineKeyboard([
        [Markup.button.callback('👤 Список пользователей', 'admin_show_users')],
        [Markup.button.callback('📱 Прямые диалоги', 'admin_direct_chats')],
        [Markup.button.callback('💻 Статус системы', 'admin_system_status')]
      ]));
    } catch (error) {
      console.error('Ошибка при обработке быстрых команд:', error);
      await ctx.answerCbQuery('Произошла ошибка');
    }
  });
  
  // Обработчик для статистики системы
  bot.action('admin_system_status', async (ctx) => {
    try {
      const adminChatId = process.env.ADMIN_CHAT_ID;
      const userId = ctx.from.id;
      const isAdmin = userId.toString() === adminChatId.toString();
      
      if (!isAdmin) {
        await ctx.answerCbQuery('Эта функция доступна только администратору');
        return;
      }
      
      await ctx.answerCbQuery();
      
      // Получаем все ключи из кэша
      const keys = cache.keys();
      const requestKeys = keys.filter(key => key.startsWith('request_'));
      const userStateKeys = keys.filter(key => key.startsWith('user_'));
      const adminStateKeys = keys.filter(key => key.startsWith('admin_'));
      
      // Статистика по запросам
      const allRequests = requestKeys.map(key => cache.get(key));
      const activeRequests = allRequests.filter(req => req.status === 'waiting' || req.status === 'new');
      const answeredRequests = allRequests.filter(req => req.status === 'answered');
      
      // Статистика пользователей
      const userIds = new Set();
      allRequests.forEach(req => req.userId && userIds.add(req.userId));
      
      const statusMessage = `📊 Статистика системы:\n\n` +
        `• Всего запросов: ${allRequests.length}\n` +
        `• Активных запросов: ${activeRequests.length}\n` +
        `• Отвеченных запросов: ${answeredRequests.length}\n` +
        `• Уникальных пользователей: ${userIds.size}\n\n` +
        `• Время работы бота: ${getUptimeString()}\n` +
        `• Режим работы: ${process.env.NODE_ENV === 'production' ? 'Продуктивный (webhook)' : 'Разработка (long-polling)'}\n`;
      
      await ctx.reply(statusMessage);
    } catch (error) {
      console.error('Ошибка при получении статистики системы:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('Произошла ошибка при получении статистики.');
    }
  });

  // Обработчик для прямых диалогов
  bot.action('admin_direct_chats', async (ctx) => {
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
        await ctx.reply('Нет активных пользователей для прямого диалога.');
        return;
      }
      
      // Создаем кнопки для прямого диалога с топ-10 пользователями
      const topUsers = userList.slice(0, 10);
      const buttons = [];
      
      topUsers.forEach(user => {
        buttons.push([
          Markup.button.url(`📱 ${user.username || 'Пользователь'} (ID: ${user.userId})`, `tg://user?id=${user.userId}`)
        ]);
      });
      
      await ctx.reply('Выберите пользователя для прямого диалога:', Markup.inlineKeyboard(buttons));
    } catch (error) {
      console.error('Ошибка при получении списка для прямых диалогов:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('Произошла ошибка при получении списка пользователей для прямых диалогов.');
    }
  });
  
  // Функция для получения времени работы бота
  function getUptimeString() {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    let result = '';
    if (days > 0) result += `${days} д. `;
    if (hours > 0 || days > 0) result += `${hours} ч. `;
    if (minutes > 0 || hours > 0 || days > 0) result += `${minutes} мин. `;
    result += `${seconds} сек.`;
    
    return result;
  }

  // Команда для получения прямой ссылки на пользователя
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
      
      // Получаем информацию о пользователе (если есть в кэше)
      let username = '';
      const keys = cache.keys();
      const requestKeys = keys.filter(key => key.startsWith('request_'));
      
      for (const key of requestKeys) {
        const request = cache.get(key);
        if (request && request.userId == targetUserId) {
          username = request.username || '';
          break;
        }
      }
      
      // Создаем ссылки для разных клиентов Telegram
      const tgLink = `tg://user?id=${targetUserId}`;
      const webLink = username ? 
        `https://t.me/${username}` : 
        `https://t.me/user?id=${targetUserId}`;
      
      // Инструкции для использования
      const instructions = `Чтобы начать прямой диалог с пользователем ${username ? username + ' ' : ''}(ID: ${targetUserId}), нажмите на кнопку ниже:

ℹ️ Важные примечания:
• При нажатии на кнопку откроется чат напрямую в Telegram
• Вы будете общаться от вашего личного аккаунта Telegram
• Пользователь будет видеть ваш профиль, а не бота
• Сообщения в прямом чате не проходят через систему бота`;

      // Создаем кнопки для разных вариантов
      await ctx.reply(instructions, Markup.inlineKeyboard([
        [Markup.button.url(`📱 Открыть диалог с пользователем`, tgLink)],
        [Markup.button.url(`🌐 Альтернативная ссылка (web)`, webLink)]
      ]));
      
      // Отправляем дополнительные советы
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
      
      await ctx.reply('Состояние сброшено. Теперь вы можете начать отвечать на новые запросы.', 
        Markup.inlineKeyboard([
          [Markup.button.callback('👤 Показать последних пользователей', 'admin_show_users')]
        ])
      );
    } catch (error) {
      console.error('Ошибка в обработчике команды /reset:', error);
      await ctx.reply('Произошла ошибка при сбросе состояния.');
    }
  });
  
  // Расширенная справка для администратора
  const adminHelpText = `🔔 Справка по работе с ботом (для куратора):\n\n` +
    `/start - Начать работу с ботом\n` +
    `/help - Показать эту справку\n` +
    `/direct ID - Открыть прямой диалог с пользователем в Telegram\n` +
    `/dm ID ТЕКСТ - Отправить сообщение через бота\n` +
    `/users - Показать список последних активных пользователей\n` +
    `/reset - Сбросить текущее состояние\n\n` +
    `🔥 УЛУЧШЕННАЯ ФУНКЦИЯ: Прямое общение с пользователями\n` +
    `При получении нового вопроса от пользователя, Вы можете:\n` +
    `1. Нажать на кнопку "📱 Открыть диалог" для прямого чата в Telegram\n` +
    `2. Использовать команду /direct ID для получения ссылки на прямой чат\n` +
    `3. Ответить через бота с помощью команды /dm или кнопки "Ответить через бота"\n\n` +
    `ℹ️ Важные примечания:\n` +
    `• При общении через прямой диалог, пользователь будет видеть Ваш личный профиль\n` +
    `• Сообщения через прямой диалог не сохраняются в системе бота\n` +
    `• Используйте вариант с кнопкой "Ответить через бота", если необходимо сохранить историю`;
  
  // Добавляем информацию об ID пользователя в сообщения с вопросами
  function addUserIdToMessage(message, userData) {
    return `${message}\n\n🔗 Для прямого чата с пользователем:\n/direct ${userData.userId}\n💬 Для ответа через бота:\n/dm ${userData.userId} Ваш ответ`;
  }
  
  return {
    adminHelpText,
    addUserIdToMessage
  };
}

module.exports = initAdminCommands;