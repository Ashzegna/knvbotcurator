/**
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

💬 Чтобы ответить напрямую:
• Через команду: /dm ${requestData.userId} Ваш ответ
• Или используйте кнопку "Прямой чат с пользователем" ниже
`;
    
    // Попытка прямой отправки сообщения куратору с кнопками
    try {
      // Отправляем сообщение администратору с кнопками для ответа и прямого чата
      await bot.telegram.sendMessage(adminChatId, adminMessage, Markup.inlineKeyboard([
        [Markup.button.callback(`✏️ Ответить на запрос #${requestData.id}`, `reply_${requestData.id}`)],
        [Markup.button.url(`💬 Прямой чат с пользователем`, `tg://user?id=${requestData.userId}`)],
        [Markup.button.callback(`🔄 Изменить категорию`, `change_category_${requestData.id}`)]
      ]));
      
      console.log(`Сообщение успешно отправлено куратору ${adminChatId}`);
    } catch (sendError) {
      console.error(`Ошибка при отправке сообщения куратору:`, sendError);
      
      // Альтернативный вариант с https ссылкой вместо tg:// протокола
      try {
        await bot.telegram.sendMessage(adminChatId, adminMessage, Markup.inlineKeyboard([
          [Markup.button.callback(`✏️ Ответить на запрос #${requestData.id}`, `reply_${requestData.id}`)],
          [Markup.button.url(`💬 Прямой чат с пользователем`, `https://t.me/${requestData.userId}`)],
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

// Экспортируем функцию
module.exports = {
  forwardRequestToAdminWithDirectLink
};