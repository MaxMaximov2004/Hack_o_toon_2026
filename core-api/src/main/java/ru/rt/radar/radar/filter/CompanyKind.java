package ru.rt.radar.radar.filter;

/**
 * Вид компании в ответах (поле kind): others — не клиент, excluded — клиент, исключённый из реестра МСП
 * (не обязательно закрылся), ours — действующий клиент РТ. В SQL — {@link CompanyFilterSql#KIND}.
 */
public enum CompanyKind implements CodedEnum {
    OURS("ours", "Клиент РТ"),
    OTHERS("others", "Не клиент РТ"),
    EXCLUDED("excluded", "Клиент РТ, исключён из реестра МСП");

    private final String code;
    private final String title;

    CompanyKind(String code, String title) {
        this.code = code;
        this.title = title;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public String title() {
        return title;
    }
}
