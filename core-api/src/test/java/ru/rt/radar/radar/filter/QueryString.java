package ru.rt.radar.radar.filter;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Тестовый помощник: "a=1&b=2&b=3" → карта параметров как у ServletRequest. */
final class QueryString {

    private QueryString() {
    }

    static Map<String, String[]> parse(String query) {
        Map<String, List<String>> tmp = new LinkedHashMap<>();
        if (!query.isEmpty()) {
            for (String pair : query.split("&")) {
                int eq = pair.indexOf('=');
                String name = eq < 0 ? pair : pair.substring(0, eq);
                String value = eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
                tmp.computeIfAbsent(name, k -> new ArrayList<>()).add(value);
            }
        }
        Map<String, String[]> result = new LinkedHashMap<>();
        tmp.forEach((k, v) -> result.put(k, v.toArray(String[]::new)));
        return result;
    }

    static CompanyFilter filter(String query) {
        return CompanyFilterParser.parse(parse(query));
    }
}
