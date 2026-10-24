package ru.rt.radar.locations;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import ru.rt.radar.clients.ClientCsvParser;
import ru.rt.radar.common.exception.NotFoundException;
import ru.rt.radar.common.exception.ValidationException;
import ru.rt.radar.radar.dictionary.Municipality;
import ru.rt.radar.radar.dictionary.MunicipalityRepository;
import ru.rt.radar.radar.web.Csv;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Фактические места ведения бизнеса (docs/tz/07-star-actual-location.md): ввод менеджером в карточке, удаление,
 * импорт CSV из CRM. Район или город — только из справочника municipality (как в /api/dictionaries),
 * координаты — его центр; «другой регион» — без координат.
 */
@Service
public class LocationService {

    private static final Logger log = LoggerFactory.getLogger(LocationService.class);

    static final String MANAGER = "manager";
    static final String CRM = "crm";
    /** Уверенность по источнику (ТЗ 07); неизвестный источник — значение таблицы по умолчанию. */
    static final Map<String, BigDecimal> CONFIDENCE = Map.of(
            CRM, new BigDecimal("0.90"), MANAGER, new BigDecimal("0.80"), "egrul", new BigDecimal("0.70"));
    static final BigDecimal DEFAULT_CONFIDENCE = new BigDecimal("0.50");

    static final int MAX_ADDRESS = 500;
    static final int MAX_NOTE = 1000;
    static final int MAX_REGION = 200;
    static final int REPORT_LIMIT = 100;
    private static final Pattern SOURCE = Pattern.compile("[a-z][a-z0-9_]{0,31}");

    private final LocationRepository locations;
    private final MunicipalityRepository municipalities;
    private final TransactionTemplate tx;

    public LocationService(LocationRepository locations, MunicipalityRepository municipalities, PlatformTransactionManager tx) {
        this.locations = locations;
        this.municipalities = municipalities;
        this.tx = new TransactionTemplate(tx);
    }

    public CompanyLocations get(int companyId) {
        LocationRepository.CompanyRef c = company(companyId);
        return new CompanyLocations(c.registered(), locations.actual(c.inn()), c.relocated());
    }

    /** Ввод менеджера: source = manager, confidence = 0.8. */
    public CompanyLocations.Actual add(int companyId, LocationRequest request) {
        LocationRepository.CompanyRef c = company(companyId);
        String municipalityName = trimToNull(request.municipalityName());
        String regionName = trimToNull(request.regionName());
        if (municipalityName == null && regionName == null) {
            throw new ValidationException("municipalityName",
                    "Укажите район или город области (municipalityName) либо другой регион (regionName)");
        }
        if (municipalityName != null && regionName != null) {
            throw new ValidationException("regionName",
                    "Укажите что-то одно: район или город области (municipalityName) либо другой регион (regionName)");
        }
        LocationRepository.Place place = municipalityName != null
                ? municipality(municipalityName).orElseThrow(() -> new ValidationException("municipalityName",
                        "Неизвестный район или город «" + municipalityName + "» — выберите из /api/dictionaries"))
                : new LocationRepository.Place(null, limit(regionName, MAX_REGION, "regionName"), null, null);
        String address = limit(trimToNull(request.address()), MAX_ADDRESS, "address");
        String note = limit(trimToNull(request.note()), MAX_NOTE, "note");
        return locations.insert(c.inn(), place, address, MANAGER, CONFIDENCE.get(MANAGER), note, false).orElseThrow();
    }

    /** Менеджер удаляет только места, введённые вручную (source = manager); admin — любые. */
    public void delete(int companyId, long locationId, boolean admin) {
        LocationRepository.CompanyRef c = company(companyId);
        CompanyLocations.Actual location = locations.find(locationId, c.inn())
                .orElseThrow(() -> new NotFoundException("Место " + locationId + " у компании " + companyId + " не найдено"));
        if (!admin && !MANAGER.equals(location.source())) {
            throw new LocationForbiddenException("Место из источника «" + location.source()
                    + "» может удалить только администратор");
        }
        locations.delete(locationId);
    }

    /**
     * CSV inn;municipality;region;address;source — с заголовком (колонки по именам) или без (в этом порядке).
     * Район области — из справочника; если он задан, регион не нужен. source пустой — crm. ИНН, которых нет в реестре,
     * не сохраняются (notFound). Точные повторы уже сохранённых мест не дублируются. Всё — в одной транзакции.
     */
    public LocationImportResult importCsv(byte[] content) {
        List<List<String>> lines = Csv.rows(content);
        Columns cols = lines.isEmpty() ? null : Columns.of(lines.get(0));
        int first = cols != null && cols.header() ? 1 : 0;
        int rows = lines.size() - first;
        if (rows <= 0) {
            throw new ValidationException("file", "Файл пустой: нет ни одной строки с адресом");
        }

        List<Row> parsed = new ArrayList<>();
        List<String> invalid = new ArrayList<>();
        for (int i = first; i < lines.size(); i++) {
            int lineNo = i + 1;
            try {
                parsed.add(parseRow(lines.get(i), cols, lineNo));
            } catch (ValidationException e) {
                if (invalid.size() < REPORT_LIMIT) {
                    invalid.add("строка " + lineNo + ": " + e.getMessage());
                }
            }
        }

        Set<String> known = new HashSet<>(locations.existingInns(
                parsed.stream().map(Row::inn).distinct().toArray(String[]::new)));
        Set<String> notFound = new LinkedHashSet<>();
        int matched = tx.execute(status -> {
            int n = 0;
            for (Row r : parsed) {
                if (!known.contains(r.inn())) {
                    notFound.add(r.inn());
                    continue;
                }
                n++;
                locations.insert(r.inn(), r.place(), r.address(), r.source(),
                        CONFIDENCE.getOrDefault(r.source(), DEFAULT_CONFIDENCE), null, true);
            }
            return n;
        });
        List<String> notFoundList = notFound.stream().limit(REPORT_LIMIT).toList();
        log.info("Импорт фактических адресов: строк {}, найдено {}, нет в реестре {}, не разобрано {}",
                rows, matched, notFound.size(), invalid.size());
        return new LocationImportResult(rows, matched, notFoundList, List.copyOf(invalid));
    }

    private Row parseRow(List<String> line, Columns cols, int lineNo) {
        String rawInn = Csv.cell(line, cols.inn());
        String inn = ClientCsvParser.normalizeInn(rawInn);
        if (inn == null) {
            throw new ValidationException("file", "ИНН «" + rawInn + "» — нужно 10 или 12 цифр");
        }
        String municipalityName = trimToNull(Csv.cell(line, cols.municipality()));
        String regionName = trimToNull(Csv.cell(line, cols.region()));
        LocationRepository.Place place;
        if (municipalityName != null) {
            place = municipality(municipalityName).orElseThrow(() -> new ValidationException("file",
                    "неизвестный район или город «" + municipalityName + "»"));
        } else if (regionName != null) {
            place = new LocationRepository.Place(null, limit(regionName, MAX_REGION, "file"), null, null);
        } else {
            throw new ValidationException("file", "не указан ни район области, ни регион");
        }
        String address = limit(trimToNull(Csv.cell(line, cols.address())), MAX_ADDRESS, "file");
        String source = Optional.ofNullable(trimToNull(Csv.cell(line, cols.source())))
                .map(s -> s.toLowerCase(Locale.ROOT)).orElse(CRM);
        if (!SOURCE.matcher(source).matches()) {
            throw new ValidationException("file", "источник «" + source + "» — латиница, например crm, egrul");
        }
        return new Row(inn, place, address, source);
    }

    private LocationRepository.CompanyRef company(int id) {
        return locations.company(id).orElseThrow(() -> new NotFoundException("Компания " + id + " не найдена"));
    }

    private Optional<LocationRepository.Place> municipality(String name) {
        return municipalities.findAll().stream()
                .filter(m -> m.name().equalsIgnoreCase(name))
                .findFirst()
                .map((Municipality m) -> new LocationRepository.Place(m.name(), null, m.lat(), m.lon()));
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String limit(String s, int max, String field) {
        if (s != null && s.length() > max) {
            throw new ValidationException(field, field + " — не длиннее " + max + " символов");
        }
        return s;
    }

    private record Row(String inn, LocationRepository.Place place, String address, String source) {
    }

    /** Номера колонок: по заголовку (inn / ИНН обязателен) или порядок inn;municipality;region;address;source. */
    private record Columns(boolean header, int inn, int municipality, int region, int address, int source) {

        static Columns of(List<String> first) {
            int inn = ClientCsvParser.innColumn(first);
            if (inn < 0) {
                return new Columns(false, 0, 1, 2, 3, 4);
            }
            return new Columns(true, inn, index(first, "municipality", "район", "муниципалитет"),
                    index(first, "region", "регион"), index(first, "address", "адрес"), index(first, "source", "источник"));
        }

        private static int index(List<String> header, String... names) {
            for (int i = 0; i < header.size(); i++) {
                String h = header.get(i).trim().toLowerCase(Locale.ROOT);
                for (String n : names) {
                    if (h.equals(n)) {
                        return i;
                    }
                }
            }
            return -1;
        }
    }
}
