/**
 * Дополнительная функция для получения данных пользователя из кэша
 * 
 * @param {Object} cache - Кэш для хранения данных
 * @param {String} userId - ID пользователя
 * @returns {Object|null} Данные пользователя или null, если не найдены
 */
function getUserData(cache, userId) {
  try {
    // Проверяем, есть ли уже профиль в кэше
    const profileData = cache.get(`user_profile_${userId}`);
    if (profileData) {
      return profileData;
    }
    
    // Ищем пользователя среди запросов
    const keys = cache.keys();
    const requestKeys = keys.filter(key => key.startsWith('request_'));
    
    let userData = null;
    for (const key of requestKeys) {
      const request = cache.get(key);
      if (request && request.userId == userId) {
        userData = {
          id: request.userId,
          username: request.username || null,
          direct_link: `tg://user?id=${userId}`,
          web_link: request.username ? `https://t.me/${request.username}` : `https://t.me/user?id=${userId}`,
          last_activity: request.lastActivity || request.created || Date.now()
        };
        break;
      }
    }
    
    if (userData) {
      // Сохраняем для быстрого доступа в будущем
      cache.set(`user_profile_${userId}`, userData);
    }
    
    return userData;
  } catch (error) {
    console.error('Ошибка при получении данных пользователя:', error);
    return null;
  }
}/**
 * Модуль для расширения функционала прямого общения администратора с пользователями
 * 
 * Данный модуль добавляет возможность администратору открывать прямой диалог
 * с пользователями через Telegram
 */

const { Markup } = require('telegraf');
const moment = require('moment');

/**
 * Функция для пересылки запроса администратору/куратору
 * с возможностью перехода в прямой чат с пользователем
 * 
 * @param {Object} bot - Экземпляр бота Telegraf
 * @param {Object} requestData - Данные запроса от пользователя
 * @param {Object} ctx - Контекст сообщения
 * @param {Object} QUESTION_CATEGORIES - Категории вопросов
 * @param {Object} cache - Кэш для хранения данных
 * @param {String} REQUEST_STATUS - Статус запроса
 */
async function forwardRequestToAdminWithDirectLink(bot, requestData, ctx, QUESTION_CATEGORIES, cache, REQUEST_STATUS) {
  try {
    // Используем ID куратора из переменных окружения
    const adminChatId = process.env.ADMIN_CHAT_ID;
    
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
    
    // Создаем сообщение с информацией о запросе
    const adminMessage = `
📩 Новый запрос #${requestData.id}

👤 Пользователь: ${requestData.username} (ID: ${requestData.userId})
📂 Категория: ${categoryText}
⏱ Время: ${moment(requestData.created).format('DD.MM.YYYY HH:mm:ss')}

📌 Текст запроса:
${requestData.text}

🔗 Для прямого ответа нажмите кнопку "Написать напрямую" ниже.
💡 Или используйте команду: /direct ${requestData.userId}
`;
    
    // Попытка прямой отправки сообщения куратору с улучшенным интерфейсом
    try {
      // Отправляем сообщение администратору с кнопками для ответа и прямого чата
      // Создаем улучшенную кнопку для прямого диалога
      await bot.telegram.sendMessage(adminChatId, adminMessage, Markup.inlineKeyboard([
        [Markup.button.url(`📱 Открыть диалог с пользователем`, `tg://user?id=${requestData.userId}`)],
        [Markup.button.callback(`✏️ Ответить через бота`, `reply_${requestData.id}`)],
        [Markup.button.callback(`🔄 Изменить категорию`, `change_category_${requestData.id}`)]
      ]));
      
      console.log(`Сообщение успешно отправлено куратору ${adminChatId}`);
    } catch (sendError) {
      console.error(`Ошибка при отправке сообщения куратору:`, sendError);
      
      // Попробуем альтернативный формат для прямого чата (https://t.me/)
      try {
        // Альтернативный вариант ссылки на пользователя через web.telegram.org
        const userLink = requestData.username ? 
          `https://t.me/${requestData.username}` : 
          `https://t.me/user?id=${requestData.userId}`;
          
        await bot.telegram.sendMessage(adminChatId, adminMessage, Markup.inlineKeyboard([
          [Markup.button.url(`📱 Открыть диалог с пользователем`, userLink)],
          [Markup.button.callback(`✏️ Ответить через бота`, `reply_${requestData.id}`)],
          [Markup.button.callback(`🔄 Изменить категорию`, `change_category_${requestData.id}`)]
        ]));
        console.log(`Отправлено альтернативное сообщение куратору ${adminChatId}`);
      } catch (alternativeSendError) {
        // Дополнительная попытка отправить простое сообщение без кнопок
        try {
          await bot.telegram.sendMessage(adminChatId, adminMessage);
          console.log(`Отправлено упрощенное сообщение куратору ${adminChatId}`);
        } catch (simpleSendError) {
          console.error(`Не удалось отправить даже простое сообщение:`, simpleSendError);
        }
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

/**
 * Функция для создания прямой ссылки на чат с пользователем
 * 
 * @param {Object} bot - Экземпляр бота Telegraf
 * @param {String} userId - ID пользователя для чата
 * @param {String} username - Имя пользователя (необязательно)
 * @returns {Object} Объект с URL и инструкциями
 */
function createDirectChatLink(userId, username) {
  try {
    // Основная ссылка на прямой чат (tg:// протокол)
    const directTgLink = `tg://user?id=${userId}`;
    
    // Альтернативная ссылка через https://t.me/
    const alternativeLink = username ? 
      `https://t.me/${username}` : 
      `https://t.me/user?id=${userId}`;
    
    // Инструкции для администратора
    const instructions = `Чтобы начать прямой диалог с пользователем (ID: ${userId}), нажмите на кнопку ниже.

ℹ️ Важные примечания:
• При нажатии на кнопку откроется чат с пользователем напрямую в Telegram
• Вы будете общаться от вашего личного аккаунта Telegram
• Пользователь будет видеть ваш профиль, а не бота
• Сообщения в прямом чате не проходят через систему бота`;
    
    // Добавляем дополнительные полезные данные
    return {
      directLink: directTgLink,
      alternativeLink: alternativeLink,
      instructions: instructions,
      userId: userId,
      username: username || null,
      deepLink: `telegram://user?id=${userId}`, // Еще один формат ссылки для некоторых клиентов
      helpText: 'Нажмите на кнопку выше, чтобы открыть прямой диалог с пользователем '
    };
  } catch (error) {
    console.error('Ошибка при создании ссылки на прямой чат:', error);
    return null;
  }
}

// Экспортируем функции
module.exports = {
  forwardRequestToAdminWithDirectLink,
  createDirectChatLink,
  getUserData
};