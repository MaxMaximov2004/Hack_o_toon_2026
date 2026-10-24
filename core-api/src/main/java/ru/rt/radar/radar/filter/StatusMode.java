package ru.rt.radar.radar.filter;

/** Параметр фильтра status: действующие в реестре МСП / только исключённые из реестра / все. */
public enum StatusMode implements CodedEnum {
    ACTIVE("active", "Действующие в реестре МСП"),
    EXCLUDED("excluded", "Исключённые из реестра МСП"),
    ALL("all", "Все");

    private final String code;
    private final String title;

    StatusMode(String code, String title) {
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
