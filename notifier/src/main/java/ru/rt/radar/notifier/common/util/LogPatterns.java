package ru.rt.radar.notifier.common.util;

/** Шаблоны сообщений и логов notifier: {} — для Slf4j, %s / %d — для String.format. */
public interface LogPatterns {

    // Exception handler (Slf4j)
    String CLIENT_ERROR = "{} {} -> [{}] {}: {} | details: {}";
    String SERVER_ERROR = "{} {} -> [{}] {}: {} | details: {}";
    String UNHANDLED_EXCEPTION = "Необработанное исключение: {} {}";

    // Ответ клиенту
    String INTERNAL_ERROR_MESSAGE = "Внутренняя ошибка сервиса";
    String NOT_FOUND_MESSAGE = "Объект не найден";

    // Exception descriptions (String.format)
    String PATH_NOT_FOUND = "Путь не найден: /%s";
    String MISSING_PARAM = "Не задан обязательный параметр '%s'";
    String MISSING_HEADER = "Отсутствует обязательный заголовок '%s'";
    String MISSING_PATH_VARIABLE = "Отсутствует переменная пути '%s'";
    String MISSING_PART = "В запросе нет части '%s' (multipart/form-data)";
    String TYPE_MISMATCH = "Неверное значение параметра %s='%s', ожидается %s";
    String METHOD_NOT_SUPPORTED = "Метод '%s' не поддерживается. Доступные методы: %s";
    String SUPPORTED_METHODS_UNDEFINED = "не определены";
    String MEDIA_TYPE_NOT_SUPPORTED = "Тип содержимого '%s' не поддерживается";
    String BODY_NOT_READABLE = "Тело запроса не читается: проверьте JSON";
    String CONSTRAINT_VIOLATION_FIELD = "Поле '%s': %s";
    String UPLOAD_TOO_LARGE = "Файл больше допустимого размера";

    // Security (Slf4j)
    String AUTH_FAILURE = "{} {} -> [{}] {}: {} | причина: {}";
    String JWKS_URL_MISSING = "AUTH_JWKS_URL не задан — все запросы с токеном будут отклонены";
    String INTERNAL_TOKEN_MISSING = "INTERNAL_TOKEN не задан — все запросы к /internal/** будут отклонены";

    // Security — ответ клиенту
    String AUTH_REQUIRED = "Требуется вход: передайте заголовок Authorization: Bearer <accessToken>";
    String TOKEN_INVALID = "Токен недействителен или истёк — войдите заново";
    String ACCESS_DENIED = "Недостаточно прав для этого действия";
    String INTERNAL_TOKEN_INVALID = "Нужен верный заголовок X-Internal-Token";
    String AUTH_UNAVAILABLE = "Сервис авторизации недоступен — повторите позже";

    // Подписки (String.format)
    String SUBSCRIPTION_EMPTY = "Укажите хотя бы одно условие подписки: industry, municipalityId, need или stage";
    String UNKNOWN_CODE = "Неизвестное значение %s='%s', допустимо: %s";
    String MUNICIPALITY_INVALID = "municipalityId должен быть положительным числом";
    String SUBSCRIPTION_NOT_FOUND = "Подписка %d не найдена";
    String NOTIFICATION_NOT_FOUND = "Уведомление %d не найдено";

    // Воркер (Slf4j)
    String CHECK_DONE = "проверка проектов: получено {}, новых уведомлений {}, отправлено в Telegram {}, lastCheckedAt={}";
    String CHECK_FAILED = "проверка проектов не удалась: {}";
    String CORE_API_UNAVAILABLE = "core-api не ответил на /internal/projects: %s";

    // Telegram (Slf4j / String.format)
    String TELEGRAM_DISABLED = "TELEGRAM_BOT_TOKEN не задан — отправка в Telegram выключена";
    String TELEGRAM_ERROR = "Telegram: {}";
    String TELEGRAM_LINKED = "Telegram: пользователь {} привязал чат {}";
    String TELEGRAM_WELCOME = "Готово! Уведомления о новых инвестпроектах по вашим подпискам будут приходить сюда.";
    String TELEGRAM_HOW_TO = "Здравствуйте! Я присылаю новые инвестпроекты по вашим подпискам. Чтобы подключить уведомления, "
            + "войдите в «Инвестиционный навигатор» → «Подписки» → «Подключить Telegram» и нажмите «Старт» по той ссылке.";
    String TELEGRAM_UNKNOWN_LINK = "Ссылка устарела. Откройте «Навигатор» → «Подписки» → «Подключить Telegram» ещё раз.";
    String TELEGRAM_MESSAGE = "Новый инвестпроект по вашей подписке:\n%s\n%s\n\nПодробности — в «Навигаторе».";

    // Security — причина отказа (в лог, через описание ошибки валидатора)
    String OTP_MISSING = "в amr нет \"otp\": вход без второго фактора";
}
