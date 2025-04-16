      // Справка для обычного пользователя
      const userHelp = `Справка по работе с ботом:\n\n` +
        `/start - Начать работу с ботом\n` +
        `/help - Показать эту справку\n\n` +
        `Чтобы задать вопрос, нажмите кнопку "❓ Задать вопрос" в меню.\n` +
        `Ваш вопрос будет передан куратору, который ответит вам в ближайшее время.`;
      
      await ctx.reply(userHelp);
    }
  } catch (error) {
    console.error('Ошибка в обработчике команды /help:', error);
    await ctx.reply('Произошла ошибка при показе справки.');
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
      
      // Отправляем приветственное сообщение
      await bot.telegram.sendMessage(adminChatId, `Привет, я бот КурсНова. Проверяю связь с вами.`);
      
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
    await ctx.reply('Отлично! Система связи с куратором работает корректно. Теперь вы будете получать уведомления о вопросах пользователей.');
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
        await processPendingRequests();
      }, 2 * 60 * 1000); // 2 минуты
    })
    .catch(err => {
      console.error('Ошибка при запуске бота:', err);
    });
  
  // Корректное завершение работы при остановке приложения
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}