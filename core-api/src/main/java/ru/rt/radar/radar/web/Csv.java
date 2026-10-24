package ru.rt.radar.radar.web;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Разбор загружаемых CSV (импорт клиентов, импорт фактических адресов): UTF-8 с BOM или без, разделитель «;» или «,» —
 * по первой строке, кавычки по правилам CSV ("ООО ""Ромашка"""), пустые строки пропускаются.
 */
public final class Csv {

    private Csv() {
    }

    /** Строки файла без пустых; каждая — список ячеек. */
    public static List<List<String>> rows(byte[] content) {
        String text = new String(content, StandardCharsets.UTF_8);
        if (text.startsWith("﻿")) {
            text = text.substring(1);
        }
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\\r?\\n|\\r", -1)) {
            if (!line.isBlank()) {
                lines.add(line);
            }
        }
        List<List<String>> rows = new ArrayList<>();
        if (lines.isEmpty()) {
            return rows;
        }
        char delimiter = lines.get(0).indexOf(';') >= 0 ? ';' : ',';
        for (String line : lines) {
            rows.add(cells(line, delimiter));
        }
        return rows;
    }

    /** Ячейки строки с учётом кавычек. */
    public static List<String> cells(String line, char delimiter) {
        List<String> cells = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else if (ch == '"') {
                    quoted = false;
                } else {
                    cur.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == delimiter) {
                cells.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(ch);
            }
        }
        cells.add(cur.toString());
        return cells;
    }

    /** Ячейка по номеру или "" (в строке меньше колонок). */
    public static String cell(List<String> row, int index) {
        return index >= 0 && index < row.size() ? row.get(index).trim() : "";
    }
}
