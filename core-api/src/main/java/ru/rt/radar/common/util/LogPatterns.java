package ru.rt.radar.common.util;

/** Шаблоны сообщений и логов core-api: {} — для Slf4j, %s / %d — для String.format. */
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
    String TOO_LARGE_EXPORT = "Найдено %d компаний, больше лимита %d — сузьте фильтр";

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

    // Security — причина отказа (в лог, через описание ошибки валидатора)
    String OTP_MISSING = "в amr нет \"otp\": вход без второго фактора";
}
