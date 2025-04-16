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
  console.log(`Получено сообщение от ${ctx.from.id}`);
  await next();
  const ms = new Date() - start;
  console.log(`Обработка заняла ${ms}ms`);
});

// Обработка команды /start
bot.start(async (ctx) => {
  try {
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

// Обработка нажатия на кнопку "Частые вопросы"
bot.hears('📚 Частые вопросы', async (ctx) => {
  try {
    await ctx.reply('Популярные вопросы и ответы:', Markup.inlineKeyboard([
      [Markup.button.callback('Как отслеживать прогресс?', 'faq_progress')],
      [Markup.button.callback('Как работает система баллов?', 'faq_points')],
      [Markup.button.callback('Сроки выполнения заданий', 'faq_deadlines')],
      [Markup.button.callback('Как получить сертификат?', 'faq_certificate')],
      [Markup.button.callback('Проблемы с доступом', 'faq_access_issues')]
    ]));
  } catch (error) {
    console.error('Ошибка при обработке кнопки "Частые вопросы":', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработчики FAQ
bot.action(/faq_(.+)/, async (ctx) => {
  try {
    const faqId = ctx.match[1];
    let response = '';
    
    switch (faqId) {
      case 'progress':
        response = 'Для отслеживания прогресса:\n\n1. Войдите в личный кабинет на сайте или в приложении\n2. Перейдите в раздел "Мой прогресс"\n3. Здесь вы увидите все доступные курсы и ваш текущий прогресс\n\nВы также можете видеть статистику по каждому предмету и получать рекомендации по дальнейшему обучению.';
        break;
      case 'points':
        response = 'Система баллов в КурсНова:\n\n• Баллы начисляются за выполнение заданий\n• Дополнительные баллы за своевременное выполнение\n• Бонусные баллы за серии правильных ответов\n\nНакопленные баллы влияют на ваш рейтинг и открывают доступ к дополнительным материалам.';
        break;
      case 'deadlines':
        response = 'Информация о сроках выполнения заданий:\n\n• Базовые задания доступны постоянно\n• Для тематических блоков указаны рекомендуемые сроки\n• Проверочные работы имеют строгие дедлайны\n\nВсе сроки отображаются в календаре вашего личного кабинета и в описании каждого задания.';
        break;
      case 'certificate':
        response = 'Для получения сертификата необходимо:\n\n1. Выполнить все обязательные задания курса\n2. Пройти итоговое тестирование с результатом не менее 80%\n3. Подтвердить свои данные в профиле\n\nПосле выполнения всех требований сертификат будет доступен в электронном виде в вашем личном кабинете.';
        break;
      case 'access_issues':
        response = 'При проблемах с доступом:\n\n• Проверьте подключение к интернету\n• Очистите кэш браузера или приложения\n• Убедитесь, что логин и пароль введены верно\n• Попробуйте восстановить пароль через форму на сайте\n\nЕсли проблема не решена, опишите ее подробнее, и наши специалисты помогут вам.';
        break;
      default:
        response = 'Информация по данному вопросу отсутствует. Пожалуйста, опишите ваш вопрос, и мы постараемся помочь.';
    }
    
    await ctx.answerCbQuery();
    await ctx.reply(response, Markup.inlineKeyboard([
      [Markup.button.callback('Назад к частым вопросам', 'back_to_faq')],
      [Markup.button.callback('Задать свой вопрос', 'ask_question')]
    ]));
  } catch (error) {
    console.error('Ошибка при обработке FAQ:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка кнопки "Назад к частым вопросам"
bot.action('back_to_faq', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Популярные вопросы и ответы:', Markup.inlineKeyboard([
      [Markup.button.callback('Как отслеживать прогресс?', 'faq_progress')],
      [Markup.button.callback('Как работает система баллов?', 'faq_points')],
      [Markup.button.callback('Сроки выполнения заданий', 'faq_deadlines')],
      [Markup.button.callback('Как получить сертификат?', 'faq_certificate')],
      [Markup.button.callback('Проблемы с доступом', 'faq_access_issues')]
    ]));
  } catch (error) {
    console.error('Ошибка при возврате к FAQ:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка кнопки "Задать свой вопрос"
bot.action('ask_question', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Выберите тему вопроса:', Markup.inlineKeyboard([
      [Markup.button.callback('📝 Вопрос по домашней работе', 'question_homework')],
      [Markup.button.callback('📱 Вопрос по приложению', 'question_app')],
      [Markup.button.callback('🔧 Технический вопрос', 'question_technical')],
      [Markup.button.callback('🤔 Другое', 'question_other')]
    ]));
  } catch (error) {
    console.error('Ошибка при переходе к форме вопроса:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка нажатия на кнопку "Связаться с командой"
bot.hears('📞 Связаться с командой', async (ctx) => {
  try {
    await ctx.reply('Для прямой связи с командой КурсНова, пожалуйста, напишите на email: support@kursnova.ru или посетите официальный сайт: kursnova.ru/help', {
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Ошибка при обработке кнопки "Связаться с командой":', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    const userState = cache.get(`user_${ctx.from.id}_state`);
    
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
    } else {
      // Если не в режиме вопроса, предлагаем меню
      await ctx.reply('Чем я могу вам помочь?', Markup.keyboard([
        ['❓ Задать вопрос'],
        ['📚 Частые вопросы', '📞 Связаться с командой']
      ]).resize());
    }
  } catch (error) {
    console.error('Ошибка при обработке текстового сообщения:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Функция для пересылки запроса администратору/куратору
async function forwardRequestToAdmin(requestData, ctx) {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    
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
`;
    
    // Отправляем сообщение администратору с кнопками для ответа
    await bot.telegram.sendMessage(adminChatId, adminMessage, Markup.inlineKeyboard([
      [Markup.button.callback(`✏️ Ответить на запрос #${requestData.id}`, `reply_${requestData.id}`)],
      [Markup.button.callback(`🔄 Изменить категорию`, `change_category_${requestData.id}`)]
    ]));
    
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
      const adminChatId = process.env.ADMIN_CHAT_ID;
      await bot.telegram.sendMessage(
        adminChatId,
        `⚠️ Напоминание: запрос #${requestId} от пользователя ${requestData.username} ожидает ответа уже более ${process.env.CURATOR_RESPONSE_TIMEOUT} минут!`,
        Markup.inlineKeyboard([
          [Markup.button.callback(`✏️ Ответить на запрос #${requestId}`, `reply_${requestId}`)]
        ])
      );
    }
  } catch (error) {
    console.error('Ошибка при проверке статуса запроса:', error);
  }
}

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

// Обработка нажатия на кнопку "Изменить категорию"
bot.action(/change_category_(.+)/, async (ctx) => {
  try {
    const requestId = ctx.match[1];
    const requestData = cache.get(`request_${requestId}`);
    
    if (!requestData) {
      await ctx.answerCbQuery('Запрос не найден или устарел');
      return;
    }
    
    await ctx.answerCbQuery();
    
    await ctx.reply(`Выберите новую категорию для запроса #${requestId}:`, Markup.inlineKeyboard([
      [Markup.button.callback('📝 Вопрос по домашней работе', `set_category_${requestId}_homework`)],
      [Markup.button.callback('📱 Вопрос по приложению', `set_category_${requestId}_app`)],
      [Markup.button.callback('🔧 Технический вопрос', `set_category_${requestId}_technical`)],
      [Markup.button.callback('🤔 Другое', `set_category_${requestId}_other`)]
    ]));
  } catch (error) {
    console.error('Ошибка при обработке нажатия на кнопку "Изменить категорию":', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка выбора новой категории
bot.action(/set_category_(.+)_(.+)/, async (ctx) => {
  try {
    const requestId = ctx.match[1];
    const newCategory = ctx.match[2];
    
    const requestData = cache.get(`request_${requestId}`);
    
    if (!requestData) {
      await ctx.answerCbQuery('Запрос не найден или устарел');
      return;
    }
    
    // Обновляем категорию запроса
    requestData.category = newCategory;
    cache.set(`request_${requestId}`, requestData);
    
    await ctx.answerCbQuery('Категория успешно изменена');
    
    let categoryText = 'Другое';
    switch (newCategory) {
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
    
    await ctx.reply(`Категория запроса #${requestId} изменена на "${categoryText}"`);
  } catch (error) {
    console.error('Ошибка при обработке выбора новой категории:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Обработка ответа от администратора
bot.on('text', async (ctx) => {
  // Для администраторов (обработка ответов)
  const adminId = ctx.from.id;
  const adminState = cache.get(`admin_${adminId}_state`);
  
  if (adminState === 'waiting_reply') {
    try {
      const requestId = cache.get(`admin_${adminId}_current_request`);
      
      if (!requestId) {
        await ctx.reply('Ошибка: запрос не найден. Пожалуйста, начните сначала.');
        cache.set(`admin_${adminId}_state`, null);
        return;
      }
      
      const requestData = cache.get(`request_${requestId}`);
      
      if (!requestData) {
        await ctx.reply('Ошибка: запрос не найден или устарел. Пожалуйста, начните сначала.');
        cache.set(`admin_${adminId}_state`, null);
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
      cache.set(`admin_${adminId}_state`, null);
      cache.set(`admin_${adminId}_current_request`, null);
      
      await ctx.reply(`Ответ на запрос #${requestId} успешно отправлен пользователю ${requestData.username}.`);
    } catch (error) {
      console.error('Ошибка при обработке ответа от администратора:', error);
      await ctx.reply('Произошла ошибка при отправке ответа. Пожалуйста, повторите попытку позже.');
      
      // Сбрасываем состояние администратора при ошибке
      cache.set(`admin_${adminId}_state`, null);
    }
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
});

// Запуск бота
if (process.env.NODE_ENV === 'production') {
  // Для Vercel и других serverless платформ используем webhook
  module.exports = async (req, res) => {
    try {
      // Обрабатываем обновление от Telegram
      await bot.handleUpdate(req.body);
      // Отвечаем с успешным статусом
      res.status(200).send('OK');
    } catch (error) {
      console.error('Ошибка при обработке webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  };
} else {
  // Для локальной разработки используем long polling
  bot.launch()
    .then(() => {
      console.log('Бот КурсНова: чат с куратором запущен в режиме long polling');
    })
    .catch(err => {
      console.error('Ошибка при запуске бота:', err);
    });
  
  // Корректное завершение работы при остановке приложения
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}