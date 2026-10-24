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
}
