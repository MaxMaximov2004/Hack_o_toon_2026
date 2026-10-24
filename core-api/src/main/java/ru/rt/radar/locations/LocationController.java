package ru.rt.radar.locations;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.rt.radar.common.dto.error.ErrorCode;
import ru.rt.radar.common.dto.error.ErrorResponseDTO;

import java.io.IOException;

/**
 * Задача со *: «зарегистрирован в одном месте, работает в другом» (docs/tz/07-star-actual-location.md).
 * Роль admin для импорта — в common/security/SecurityConfig; удаление чужих мест — проверка здесь.
 */
@RestController
@Tag(name = "Где работает компания (задача со *)")
public class LocationController {

    private static final Logger log = LoggerFactory.getLogger(LocationController.class);

    private final LocationService service;

    public LocationController(LocationService service) {
        this.service = service;
    }

    @GetMapping("/api/companies/{id}/locations")
    @Operation(summary = "Место регистрации и фактические места компании",
            description = "registered — из реестра МСП; actual — фактические места (ввод менеджеров, CRM, ЕГРЮЛ) "
                    + "с источником и уверенностью, свежие первыми; relocated — работает не там, где зарегистрирована.")
    public CompanyLocations get(@PathVariable int id) {
        return service.get(id);
    }

    @PostMapping("/api/companies/{id}/locations")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Указать фактическое место (ввод менеджера)",
            description = "Ровно одно из municipalityName (район или город области — из /api/dictionaries) и regionName "
                    + "(другой регион). Координаты — центр муниципалитета. source = manager, confidence = 0.8.")
    public CompanyLocations.Actual add(@PathVariable int id, @RequestBody LocationRequest request) {
        return service.add(id, request);
    }

    @DeleteMapping("/api/companies/{id}/locations/{locationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Удалить фактическое место",
            description = "Менеджер — только введённые вручную (source = manager), admin — любые. Нет места — 404.")
    public void delete(@PathVariable int id, @PathVariable long locationId) {
        service.delete(id, locationId, isAdmin());
    }

    @PostMapping(value = "/api/locations/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Импорт фактических адресов из CSV (роль admin)",
            description = "Колонки inn;municipality;region;address;source — с заголовком или в этом порядке. Район — из "
                    + "справочника; source пустой — crm. ИНН не из реестра — в notFound, неразобранные строки — в invalid. "
                    + "Повторный импорт того же файла не создаёт дублей. Адреса переживают перезагрузку ETL.")
    public LocationImportResult importLocations(
            @Parameter(description = "CSV-файл (UTF-8, с BOM или без), до 10 МБ") @RequestPart("file") MultipartFile file)
            throws IOException {
        return service.importCsv(file.getBytes());
    }

    @ExceptionHandler(LocationForbiddenException.class)
    ResponseEntity<ErrorResponseDTO> forbidden(LocationForbiddenException e) {
        log.warn("DELETE location -> [403] FORBIDDEN: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponseDTO.of(ErrorCode.FORBIDDEN, e.getMessage(), null));
    }

    private static boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
