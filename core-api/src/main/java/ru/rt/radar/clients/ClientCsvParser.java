package ru.rt.radar.clients;

import ru.rt.radar.radar.web.Csv;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Разбор CSV со списком клиентов (docs/tz/03-java-2-techlead.md, «clients/»). Без БД — только ИНН из файла.
 * <ul>
 *   <li>UTF-8 с BOM или без; разделитель «;» или «,» — по первой строке ({@link Csv});</li>
 *   <li>ИНН — колонка inn / ИНН (без регистра), иначе первая. Если колонки с таким заголовком нет, первая строка
 *       считается заголовком, только когда в её первой ячейке не цифры;</li>
 *   <li>в ИНН — только цифры; 10 или 12 — как есть, 9 или 11 — дописать ведущий ноль (Excel съедает ноль),
 *       иначе — в invalid. Дубли убираются, порядок — как в файле;</li>
 *   <li>rows — строки данных: без заголовка и пустых строк.</li>
 * </ul>
 */
public final class ClientCsvParser {

    record Result(int rows, List<String> inns, List<String> invalid) {
    }

    private ClientCsvParser() {
    }

    static Result parse(byte[] content) {
        List<List<String>> lines = Csv.rows(content);
        if (lines.isEmpty()) {
            return new Result(0, List.of(), List.of());
        }
        List<String> first = lines.get(0);
        int column = innColumn(first);
        boolean hasHeader = column >= 0 || !looksLikeNumber(Csv.cell(first, 0));
        if (column < 0) {
            column = 0;
        }

        Set<String> inns = new LinkedHashSet<>();
        List<String> invalid = new ArrayList<>();
        int rows = 0;
        for (int i = hasHeader ? 1 : 0; i < lines.size(); i++) {
            rows++;
            String raw = Csv.cell(lines.get(i), column);
            String inn = normalizeInn(raw);
            if (inn != null) {
                inns.add(inn);
            } else {
                invalid.add(raw);
            }
        }
        return new Result(rows, List.copyOf(inns), List.copyOf(invalid));
    }

    /** Только цифры; 10/12 — как есть, 9/11 — с ведущим нулём; иначе null. Используется и импортом адресов. */
    public static String normalizeInn(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty() || !v.chars().allMatch(Character::isDigit) || !v.chars().allMatch(c -> c < 128)) {
            return null;
        }
        return switch (v.length()) {
            case 10, 12 -> v;
            case 9, 11 -> "0" + v;
            default -> null;
        };
    }

    /** Номер колонки inn / ИНН (без регистра) или -1. */
    public static int innColumn(List<String> header) {
        for (int i = 0; i < header.size(); i++) {
            String name = header.get(i).trim().toLowerCase(Locale.ROOT);
            if (name.equals("inn") || name.equals("инн")) {
                return i;
            }
        }
        return -1;
    }

    private static boolean looksLikeNumber(String cell) {
        return !cell.isEmpty() && cell.chars().allMatch(Character::isDigit);
    }
}
