package ru.rt.radar.clients;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import ru.rt.radar.common.exception.ValidationException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Обновление списка клиентов РТ без пересборки — например, свежей выгрузкой из CRM.
 * Единственное место core-api, которое пишет в БД: меняет только company.is_client (статус active/excluded определяет
 * реестр — не трогаем), потом пересчитывает районы ТОЙ ЖЕ SQL-функцией, что ETL. Всё — в одной транзакции.
 * ETL при перезагрузке пересобирает company из кейса и реестра — импорт при этом пропадёт (docs/tz/03).
 */
@Service
public class ClientImportService {

    private static final Logger log = LoggerFactory.getLogger(ClientImportService.class);

    public static final String APPEND = "append";
    public static final String REPLACE = "replace";
    static final int NOT_FOUND_LIMIT = 100;

    private final NamedParameterJdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public ClientImportService(NamedParameterJdbcTemplate jdbc, PlatformTransactionManager tx) {
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(tx);
    }

    public ClientImportResult importCsv(byte[] content, String mode) {
        if (!APPEND.equals(mode) && !REPLACE.equals(mode)) {
            throw new ValidationException("mode", "mode принимает append или replace, получено '" + mode + "'");
        }
        ClientCsvParser.Result csv = ClientCsvParser.parse(content);
        if (csv.rows() == 0) {
            throw new ValidationException("file", "Файл пустой: нет ни одной строки с ИНН");
        }
        if (csv.inns().isEmpty()) {
            throw new ValidationException("file", "В файле нет ни одного ИНН из 10 или 12 цифр");
        }
        String[] inns = csv.inns().toArray(String[]::new);

        ClientImportResult result = tx.execute(status -> {
            if (REPLACE.equals(mode)) {
                jdbc.getJdbcTemplate().update("UPDATE company SET is_client = false, updated_at = now() WHERE is_client");
            }
            List<String> matchedInns = jdbc.queryForList("""
                    UPDATE company SET is_client = true, updated_at = now()
                    WHERE inn = ANY(:inns)
                    RETURNING inn
                    """, new MapSqlParameterSource("inns", inns), String.class);
            Integer whiteSpots = jdbc.getJdbcTemplate().queryForObject("SELECT refresh_municipality_stats()", Integer.class);

            Set<String> matched = new HashSet<>(matchedInns);
            List<String> notFound = new ArrayList<>();
            for (String inn : csv.inns()) {
                if (!matched.contains(inn) && notFound.size() < NOT_FOUND_LIMIT) {
                    notFound.add(inn);
                }
            }
            for (String raw : csv.invalid()) {
                if (notFound.size() < NOT_FOUND_LIMIT) {
                    notFound.add(raw);
                }
            }
            return new ClientImportResult(csv.rows(), matchedInns.size(), notFound, mode, whiteSpots == null ? 0 : whiteSpots);
        });
        log.info("Импорт клиентов: mode={}, строк {}, ИНН {}, найдено {}, белых пятен {}",
                mode, result.rows(), inns.length, result.matched(), result.whiteSpots());
        return result;
    }
}
