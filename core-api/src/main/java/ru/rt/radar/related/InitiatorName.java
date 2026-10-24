package ru.rt.radar.related;

import java.util.Arrays;
import java.util.Comparator;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Нормализация названия для поиска инициатора проекта в реестре (docs/tz/08-product2-contract.md):
 * «ООО «РЫБНАЯ ФЕРМА «ЭКОДОН»» и «ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "РЫБНАЯ ФЕРМА "ЭКОДОН""» → «рыбная ферма экодон».
 */
public final class InitiatorName {

    /** ОПФ целыми словами; длинные формы раньше коротких, чтобы «акционерное общество» не съело часть другой. */
    private static final Pattern OPF = Pattern.compile("\\b(" + String.join("|",
            "общество с ограниченной ответственностью",
            "(публичное|непубличное|закрытое|открытое) акционерное общество",
            "акционерное общество",
            "индивидуальный предприниматель",
            "специализированный застройщик",
            "сельскохозяйственный производственный кооператив",
            "группа компаний",
            "ооо", "пао", "оао", "зао", "нао", "ао", "ип", "сз", "спк", "кфх", "гк") + ")\\b",
            Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern NOT_WORD = Pattern.compile("[^\\w\\s-]", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern SPACES = Pattern.compile("\\s+");

    /** Короче — не ищем: слишком много случайных совпадений. */
    static final int MIN_TOKEN = 3;

    private InitiatorName() {
    }

    public static String normalize(String name) {
        if (name == null) {
            return "";
        }
        String s = name.toLowerCase(Locale.ROOT).replace('ё', 'е');
        s = OPF.matcher(s).replaceAll(" ");
        s = NOT_WORD.matcher(s).replaceAll(" ");
        return SPACES.matcher(s).replaceAll(" ").trim();
    }

    /** Самое длинное слово нормализованного названия — для предварительного отбора в SQL (LIKE). */
    static String longestToken(String normalized) {
        return Arrays.stream(normalized.split(" "))
                .max(Comparator.comparingInt(String::length))
                .filter(t -> t.length() >= MIN_TOKEN)
                .orElse(null);
    }
}
