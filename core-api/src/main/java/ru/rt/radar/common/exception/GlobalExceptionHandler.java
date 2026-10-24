package ru.rt.radar.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.ErrorResponse;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingPathVariableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import ru.rt.radar.common.dto.error.ErrorCode;
import ru.rt.radar.common.dto.error.ErrorResponseDTO;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

import static ru.rt.radar.common.util.LogPatterns.*;

/**
 * Единый формат ошибок core-api: { "error": { "code", "message", "details" } } (docs/tz/00-common.md).
 * 4xx — WARN одной строкой, 5xx — ERROR; стектрейс только в лог, клиенту — общий текст.
 */
@RestControllerAdvice
@SuppressWarnings("unused")
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Ловит всё, что не поймали обработчики ниже.
     * Исключения Spring MVC со своим 4xx-статусом (406 и т. п.) не превращаем в 500.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDTO> handleException(Exception ex) {
        if (ex instanceof ErrorResponse er && er.getStatusCode().is4xxClientError()) {
            HttpStatus status = HttpStatus.valueOf(er.getStatusCode().value());
            return setErrorResponseDTO(status, ErrorCode.VALIDATION_ERROR, status.getReasonPhrase(), null);
        }
        HttpServletRequest request = currentRequest();
        log.error(UNHANDLED_EXCEPTION, method(request), uri(request), ex); // полный стектрейс — в лог, один раз
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponseDTO.of(ErrorCode.INTERNAL_ERROR, INTERNAL_ERROR_MESSAGE, null));
    }

    /**
     * Неверный параметр запроса (фильтр, сортировка, пагинация).
     * GET /api/companies?revenueMin=200&revenueMax=100
     */
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponseDTO> handleValidationException(ValidationException ex) {
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, ex.getMessage(),
                field(ex.getField()));
    }

    /**
     * Объект не найден.
     * GET /api/companies/999999
     */
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ErrorResponseDTO> handleNotFoundException(NotFoundException ex) {
        String message = ex.getMessage() != null ? ex.getMessage() : NOT_FOUND_MESSAGE;
        return setErrorResponseDTO(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message, null);
    }

    /**
     * Выгрузка больше лимита — фронт показывает «сузьте фильтр (N компаний)».
     */
    @ExceptionHandler(TooLargeException.class)
    public ResponseEntity<ErrorResponseDTO> handleTooLargeException(TooLargeException ex) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("total", ex.getTotal());
        details.put("limit", ex.getLimit());
        return setErrorResponseDTO(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.TOO_LARGE, ex.getMessage(), details);
    }

    /**
     * Ошибки валидации @Valid в теле запроса.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponseDTO> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return fieldsError(fields);
    }

    /**
     * Ошибка валидации @RequestParam / @PathVariable встроенной проверкой Spring 6.1+.
     * GET /api/...?size=0  (на параметре @Min(1))
     */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponseDTO> handleHandlerMethodValidation(HandlerMethodValidationException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (ParameterValidationResult result : ex.getParameterValidationResults()) {
            String name = result.getMethodParameter().getParameterName();
            result.getResolvableErrors().forEach(error -> fields.putIfAbsent(name, error.getDefaultMessage()));
        }
        return fieldsError(fields);
    }

    /**
     * Ошибка валидации @PathVariable и @RequestParam (@Min, @Pattern и т. п. на параметрах).
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponseDTO> handleConstraintViolationException(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(v -> String.format(CONSTRAINT_VIOLATION_FIELD, leafName(v), v.getMessage()))
                .collect(Collectors.joining(", "));
        String field = ex.getConstraintViolations().stream().findFirst().map(GlobalExceptionHandler::leafName)
                .orElse(null);
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, message, field(field));
    }

    /**
     * Путь не найден.
     * GET /api/несуществующий/путь
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponseDTO> handleNoResourceFound(NoResourceFoundException ex) {
        return setErrorResponseDTO(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND,
                String.format(PATH_NOT_FOUND, ex.getResourcePath()), null);
    }

    /**
     * Отсутствует обязательный @RequestParam.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponseDTO> handleMissingParam(MissingServletRequestParameterException ex) {
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                String.format(MISSING_PARAM, ex.getParameterName()), field(ex.getParameterName()));
    }

    /**
     * Отсутствует обязательный @RequestHeader.
     */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponseDTO> handleMissingHeader(MissingRequestHeaderException ex) {
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                String.format(MISSING_HEADER, ex.getHeaderName()), field(ex.getHeaderName()));
    }

    /**
     * Отсутствует @PathVariable.
     */
    @ExceptionHandler(MissingPathVariableException.class)
    public ResponseEntity<ErrorResponseDTO> handleMissingPathVariable(MissingPathVariableException ex) {
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                String.format(MISSING_PATH_VARIABLE, ex.getVariableName()), field(ex.getVariableName()));
    }

    /**
     * Нет части multipart-запроса.
     * POST /api/clients/import без file
     */
    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponseDTO> handleMissingPart(MissingServletRequestPartException ex) {
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                String.format(MISSING_PART, ex.getRequestPartName()), field(ex.getRequestPartName()));
    }

    /**
     * Неверный тип параметра.
     * GET /api/companies/abc  (ожидается int id)
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponseDTO> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String expectedType = ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown";
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                String.format(TYPE_MISMATCH, ex.getName(), ex.getValue(), expectedType), field(ex.getName()));
    }

    /**
     * Тело запроса не разбирается (битый JSON, неверный тип поля).
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponseDTO> handleNotReadable(HttpMessageNotReadableException ex) {
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, BODY_NOT_READABLE, null);
    }

    /**
     * Неподдерживаемый HTTP метод. Возвращает доступные.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponseDTO> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        String supportedMethods = ex.getSupportedMethods() != null
                ? String.join(", ", ex.getSupportedMethods())
                : SUPPORTED_METHODS_UNDEFINED;
        return setErrorResponseDTO(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.VALIDATION_ERROR,
                String.format(METHOD_NOT_SUPPORTED, ex.getMethod(), supportedMethods), null);
    }

    /**
     * Неподдерживаемый Content-Type.
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponseDTO> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex) {
        return setErrorResponseDTO(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.VALIDATION_ERROR,
                String.format(MEDIA_TYPE_NOT_SUPPORTED, ex.getContentType()), null);
    }

    /**
     * Загружаемый файл больше лимита (CSV клиентов — до 10 МБ).
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponseDTO> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return setErrorResponseDTO(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.TOO_LARGE, UPLOAD_TOO_LARGE, null);
    }


    private ResponseEntity<ErrorResponseDTO> setErrorResponseDTO(HttpStatus status, ErrorCode code, String message,
                                                                 Map<String, Object> details) {
        HttpServletRequest request = currentRequest();
        if (status.is4xxClientError()) {
            log.warn(CLIENT_ERROR, method(request), uri(request), status.value(), code, message, details);
        } else {
            log.error(SERVER_ERROR, method(request), uri(request), status.value(), code, message, details);
        }
        return ResponseEntity.status(status).body(ErrorResponseDTO.of(code, message, details));
    }

    /** 400 по нескольким полям: details.field — первое поле с ошибкой, details.fields — все: поле -> сообщение. */
    private ResponseEntity<ErrorResponseDTO> fieldsError(Map<String, String> fields) {
        String message = fields.entrySet().stream()
                .map(e -> String.format(CONSTRAINT_VIOLATION_FIELD, e.getKey(), e.getValue()))
                .collect(Collectors.joining(", "));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("field", fields.isEmpty() ? null : fields.keySet().iterator().next());
        details.put("fields", fields);
        return setErrorResponseDTO(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, message, details);
    }

    private static Map<String, Object> field(String field) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("field", field);
        return details;
    }

    /** Из пути нарушения "list.size" берём имя параметра "size". */
    private static String leafName(ConstraintViolation<?> violation) {
        String path = violation.getPropertyPath().toString();
        return path.substring(path.lastIndexOf('.') + 1);
    }

    private static HttpServletRequest currentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
                ? attrs.getRequest()
                : null;
    }

    private static String method(HttpServletRequest request) {
        return request != null ? request.getMethod() : "-";
    }

    private static String uri(HttpServletRequest request) {
        return request != null ? request.getRequestURI() : "-";
    }
}
