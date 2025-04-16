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

// Объединенный обработчик текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    // Проверяем, является ли отправитель куратором
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const userId = ctx.from.id;
    const userIdStr = userId.toString();
    const adminIdStr = adminChatId.toString();
    const isAdmin = userIdStr === adminIdStr;
    
    console.log(`Проверка совпадения ID: пользователь (${userIdStr}), куратор (${adminIdStr}), результат: ${isAdmin}`);
    
    // Проверяем состояние куратора
    const adminState = cache.get(`admin_${userId}_state`);
    
    console.log(`Получено сообщение от ${userId}, isAdmin: ${isAdmin}, adminState: ${adminState}`, ctx.message.text);
    
    // Если это куратор в режиме ответа на вопрос
    if (isAdmin && adminState === 'waiting_reply') {
      try {
        const requestId = cache.get(`admin_${userId}_current_request`);
        
        if (!requestId) {
          await ctx.reply('Ошибка: запрос не найден. Пожалуйста, начните сначала.');
          cache.set(`admin_${userId}_state`, null);
          return;
        }
        
        const requestData = cache.get(`request_${requestId}`);
        
        if (!requestData) {
          await ctx.reply('Ошибка: запрос не найден или устарел. Пожалуйста, начните сначала.');
          cache.set(`admin_${userId}_state`, null);
          return;
        }
        
        const replyText = ctx.message.text;
        
        console.log(`Отправка ответа пользователю ${requestData.userId} на запрос ${requestId}`);
        
        // Отправляем ответ пользователю с обработкой ошибок
        try {
          const sentMessage = await bot.telegram.sendMessage(
            requestData.userId,
            `Ответ на ваш вопрос:\n\n${replyText}`
          );
          
          console.log(`Ответ успешно отправлен пользователю:`, sentMessage);
          
          // Обновляем статус запроса
          requestData.status = REQUEST_STATUS.ANSWERED;
          requestData.answerText = replyText;
          requestData.answeredBy = ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim();
          requestData.answeredAt = Date.now();
          
          cache.set(`request_${requestId}`, requestData);
          
          // Сбрасываем состояние куратора
          cache.set(`admin_${userId}_state`, null);
          cache.set(`admin_${userId}_current_request`, null);
          
          await ctx.reply(`Ответ на запрос #${requestId} успешно отправлен пользователю ${requestData.username}.`);
        } catch (sendError) {
          console.error('Ошибка при отправке ответа пользователю:', sendError);
          console.error('Подробности ошибки:', JSON.stringify(sendError));
          
          await ctx.reply(`Ошибка при отправке ответа! Пользователь с ID ${requestData.userId} недоступен или заблокировал бота.`);
          
          // Сбрасываем состояние куратора при ошибке
          cache.set(`admin_${userId}_state`, null);
          cache.set(`admin_${userId}_current_request`, null);
        }
      } catch (error) {
        console.error('Ошибка при обработке ответа от куратора:', error);
        console.error('Подробности ошибки:', JSON.stringify(error));
        await ctx.reply('Произошла ошибка при отправке ответа. Пожалуйста, повторите попытку позже.');
        
        // Сбрасываем состояние куратора при ошибке
        cache.set(`admin_${userId}_state`, null);
      }
    } 
    // Обработка сообщений от обычных пользователей
    else {
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
        
        console.log(`Зарегистрирован новый запрос #${requestId} от пользователя ${ctx.from.id}`);
        
        // Отправляем запрос куратору
        const forwardResult = await forwardRequestToAdmin(requestData, ctx);
        
        // Если отправка не удалась, добавим в очередь на повторную отправку
        if (!forwardResult) {
          let pendingRequests = cache.get('pending_requests') || [];
          pendingRequests.push(requestData.id);
          cache.set('pending_requests', pendingRequests);
          console.log(`Запрос #${requestId} добавлен в очередь на повторную отправку`);
        }
        
        // Устанавливаем таймер для проверки ответа
        setTimeout(() => checkRequestStatus(requestId, ctx), process.env.CURATOR_RESPONSE_TIMEOUT * 60 * 1000);
      } else {
        // Если не в режиме вопроса, предлагаем меню
        await ctx.reply('Чем я могу вам помочь?', Markup.keyboard([
          ['❓ Задать вопрос'],
          ['📚 Частые вопросы', '📞 Связаться с командой']
        ]).resize());
      }
    }
  } catch (error) {
    console.error('Ошибка при обработке текстового сообщения:', error);
    console.error('Подробности ошибки:', JSON.stringify(error));
    await ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

// Функция для пересылки запроса куратору
async function forwardRequestToAdmin(requestData, ctx) {
  try {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    
    // Проверка корректности ID куратора
    if (!adminChatId || adminChatId.length < 6) {
      console.error(`Некорректный ID куратора: ${adminChatId}. ID должен быть числом из 9-10 цифр для персональных аккаунтов`);
      if (ctx) {
        await ctx.reply('Извините, произошла ошибка при попытке связаться с куратором. Мы работаем над решением проблемы.');
      }
      return false;
    }
    
    console.log(`Попытка отправить сообщение куратору. ID чата куратора: ${adminChatId}`);
    
    // Проверим сначала, что куратор доступен и бот может ему писать
    try {
      // Попробуем получить информацию о чате с куратором
      // Или отправить маленькое сообщение, чтобы проверить доступность
      await bot.telegram.sendChatAction(adminChatId, 'typing');
      console.log('Куратор доступен для сообщений');
    } catch (chatError) {
      console.error('Ошибка при проверке доступности куратора:', chatError);
      console.error('Подробности ошибки:', JSON.stringify(chatError));
      
      // Ошибка может означать, что куратор не начал диалог с ботом
      if (ctx) {
        await ctx.reply('Извините, произошла ошибка при попытке связаться с куратором. Возможно, куратор еще не начал диалог с ботом. Мы сохраним ваш вопрос и ответим на него как только это станет возможно.');
      }
      
      // Сохраняем запрос и устанавливаем статус WAITING
      requestData.status = REQUEST_STATUS.WAITING;
      cache.set(`request_${requestData.id}`, requestData);
      return false;
    }
    
    // Формируем сообщение для куратора
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
    
    console.log('Подготовлено сообщение для куратора:', adminMessage);
    
    // Отправляем сообщение куратору с кнопками для ответа
    console.log('Отправляем сообщение куратору...');
    try {
      const sentMessage = await bot.telegram.sendMessage(adminChatId, adminMessage, Markup.inlineKeyboard([
        [Markup.button.callback(`✏️ Ответить на запрос #${requestData.id}`, `reply_${requestData.id}`)],
        [Markup.button.callback(`🔄 Изменить категорию`, `change_category_${requestData.id}`)]
      ]));
      
      console.log('Сообщение успешно отправлено куратору:', sentMessage);
    } catch (sendError) {
      console.error('Ошибка при отправке сообщения куратору:', sendError);
      if (ctx) {
        await ctx.reply('Извините, произошла ошибка при передаче вашего вопроса куратору. Мы сохраним ваш вопрос и попробуем отправить его повторно.');
      }
      return false;
    }
    
    // Обновляем статус запроса
    requestData.status = REQUEST_STATUS.WAITING;
    cache.set(`request_${requestData.id}`, requestData);
    return true;
    
  } catch (error) {
    console.error('Ошибка при пересылке запроса куратору:', error);
    console.error('Подробности ошибки:', JSON.stringify(error));
    
    // Отправка уведомления пользователю в случае ошибки
    if (ctx) {
      try {
        await ctx.reply('Извините, произошла техническая ошибка при передаче вашего вопроса куратору. Мы работаем над исправлением проблемы.');
      } catch (replyError) {
        console.error('Не удалось отправить уведомление пользователю об ошибке:', replyError);
      }
    }
    
    return false;
  }
}

// Функция для попытки повторной отправки сообщений из очереди
async function processPendingRequests() {
  try {
    // Получаем список ожидающих запросов
    const pendingRequests = cache.get('pending_requests') || [];
    
    if (pendingRequests.length === 0) {
      // Нет ожидающих запросов
      return;
    }
    
    console.log(`Найдено ${pendingRequests.length} ожидающих запросов. Попытка повторной отправки...`);
    
    // Обрабатываем не более 5 запросов за раз, чтобы не перегружать систему
    const requestsToProcess = pendingRequests.slice(0, 5);
    const remainingRequests = pendingRequests.slice(5);
    
    // Сохраняем оставшиеся запросы в очереди
    cache.set('pending_requests', remainingRequests);
    
    // Обрабатываем каждый запрос
    for (const requestId of requestsToProcess) {
      const requestData = cache.get(`request_${requestId}`);
      
      if (!requestData) {
        console.log(`Запрос #${requestId} не найден в кэше. Пропускаем.`);
        continue;
      }
      
      console.log(`Повторная отправка запроса #${requestId}...`);
      
      // Пытаемся отправить запрос куратору
      const forwardResult = await forwardRequestToAdmin(requestData);
      
      if (forwardResult) {
        console.log(`Запрос #${requestId} успешно отправлен куратору`);
        
        // Отправляем уведомление пользователю, что его запрос теперь доступен куратору
        try {
          await bot.telegram.sendMessage(
            requestData.userId,
            `Ваш вопрос успешно передан куратору. Ожидайте ответ в ближайшее время.`
          );
        } catch (notifyError) {
          console.error(`Ошибка при отправке уведомления пользователю:`, notifyError);
        }
      } else {
        console.log(`Не удалось отправить запрос #${requestId} куратору. Добавляем обратно в очередь.`);
        
        // Добавляем запрос обратно в конец очереди
        remainingRequests.push(requestId);
        cache.set('pending_requests', remainingRequests);
      }
      
      // Небольшая пауза между отправками
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Ошибка при обработке очереди запросов:', error);
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

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
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