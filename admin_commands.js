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
            lastActivity: request.lastActivity,
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
      
      message += '\n💬 Для отправки сообщения используйте:\n/dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ_СООБЩЕНИЯ';
      
      await ctx.reply(message);
    } catch (error) {
      console.error('Ошибка в обработчике команды /users:', error);
      await ctx.reply('Произошла ошибка при получении списка пользователей.');
    }
  });
  
  // Расширенная справка для администратора
  const adminHelpText = `Справка по работе с ботом (для куратора):\n\n` +
    `/start - Начать работу с ботом\n` +
    `/help - Показать эту справку\n` +
    `/dm ID_ПОЛЬЗОВАТЕЛЯ ТЕКСТ - Отправить прямое сообщение пользователю\n` +
    `/users - Показать список последних активных пользователей\n` +
    `/reset - Сбросить текущее состояние\n\n` +
    `При получении нового вопроса от пользователя, вы можете:\n` +
    `1. Ответить через кнопку "Ответить на запрос"\n` +
    `2. Отправить прямое сообщение с помощью команды /dm`;
  
  // Добавляем информацию об ID пользователя в сообщения с вопросами
  function addUserIdToMessage(message, userData) {
    return `${message}\n\n💬 Чтобы ответить напрямую, используйте команду:\n/dm ${userData.userId} Ваш ответ`;
  }
  
  return {
    adminHelpText,
    addUserIdToMessage
  };
}

module.exports = initAdminCommands;