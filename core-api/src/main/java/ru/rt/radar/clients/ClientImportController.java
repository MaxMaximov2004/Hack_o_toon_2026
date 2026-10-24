package ru.rt.radar.clients;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** Роль admin проверяет common/security/SecurityConfig (POST /api/clients/import → hasRole ADMIN). */
@RestController
@Tag(name = "Клиенты РТ")
public class ClientImportController {

    private final ClientImportService service;

    public ClientImportController(ClientImportService service) {
        this.service = service;
    }

    // consumes: без него не-multipart запрос дал бы MultipartException → 500; так — 415 в общем формате
    @PostMapping(value = "/api/clients/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Обновить список клиентов РТ из CSV (роль admin)",
            description = "CSV до 10 МБ: колонка inn / ИНН или первая, разделитель «;» или «,». append — добавить к текущим, "
                    + "replace — заменить список целиком. Меняется только признак клиента, статус в реестре — нет. "
                    + "После импорта районы и белые пятна пересчитываются той же SQL-функцией, что у ETL. "
                    + "Перезагрузка ETL пересобирает компании — импорт при этом пропадает.")
    public ClientImportResult importClients(
            @Parameter(description = "CSV-файл (UTF-8, с BOM или без)")
            @RequestPart("file") MultipartFile file,
            @Parameter(description = "append (по умолчанию) или replace",
                    schema = @Schema(allowableValues = {ClientImportService.APPEND, ClientImportService.REPLACE},
                            defaultValue = ClientImportService.APPEND))
            @RequestParam(defaultValue = ClientImportService.APPEND) String mode) throws IOException {
        return service.importCsv(file.getBytes(), mode.trim());
    }
}
