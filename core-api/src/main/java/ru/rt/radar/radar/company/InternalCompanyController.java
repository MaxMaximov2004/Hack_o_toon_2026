package ru.rt.radar.radar.company;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SequenceWriter;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import ru.rt.radar.common.exception.TooLargeException;
import ru.rt.radar.common.exception.ValidationException;
import ru.rt.radar.radar.filter.CompanyFilter;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

/**
 * Выгрузка для export-service. Защита X-Internal-Token — в common/ (Java #2); снаружи nginx отдаёт на /internal/ 404.
 */
@RestController
@Tag(name = "Внутреннее (export-service)")
public class InternalCompanyController {

    static final int MAX_LIMIT = 100_000;

    private static final MediaType JSON_UTF8 = new MediaType("application", "json", StandardCharsets.UTF_8);

    private final CompanyRepository companies;
    private final ObjectMapper mapper;

    public InternalCompanyController(CompanyRepository companies, ObjectMapper mapper) {
        this.companies = companies;
        this.mapper = mapper;
    }

    @GetMapping("/internal/companies")
    @Operation(summary = "Все компании по фильтру — потоком, для экспорта",
            description = "Тот же CompanyFilter, что у списка и карты; сортировка по name. Без пагинации: "
                    + "больше limit → 413 TOO_LARGE с details.total. Отдаётся потоком, весь список в памяти не собирается.",
            responses = {
                    @ApiResponse(responseCode = "200", content = @Content(mediaType = "application/json",
                            array = @ArraySchema(schema = @Schema(implementation = Company.class)))),
                    @ApiResponse(responseCode = "413", description = "Компаний больше limit")})
    public ResponseEntity<StreamingResponseBody> companies(
            CompanyFilter filter,
            @Parameter(description = "Максимум компаний в выгрузке, 1–" + MAX_LIMIT,
                    schema = @Schema(minimum = "1", maximum = "" + MAX_LIMIT, defaultValue = "" + MAX_LIMIT))
            @RequestParam(defaultValue = "" + MAX_LIMIT) int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new ValidationException("limit", "limit должен быть от 1 до " + MAX_LIMIT);
        }
        // Считаем до начала ответа: после первой строки статус уже не поменять
        long total = companies.count(filter);
        if (total > limit) {
            throw new TooLargeException(total, limit);
        }
        StreamingResponseBody body = out -> {
            // Без flush после каждой компании — Jackson и Tomcat буферизуют сами
            SequenceWriter json = mapper.writerFor(Company.class)
                    .without(SerializationFeature.FLUSH_AFTER_WRITE_VALUE)
                    .writeValuesAsArray(out);
            companies.streamByName(filter, company -> {
                try {
                    json.write(company);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
            // Закрываем (пишем «]») только при успехе: при ошибке посреди потока клиент получит
            // заведомо битый JSON, а не обрезанный, но «правильный» массив.
            json.close();
        };
        return ResponseEntity.ok().contentType(JSON_UTF8).body(body);
    }
}
