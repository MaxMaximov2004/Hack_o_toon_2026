package ru.rt.radar.radar.filter;

/** Стадия инвестпроекта (продукт 2, docs/tz/08-product2-contract.md). Коды не менять. */
public enum Stage implements CodedEnum {
    DESIGN("design", "Проектирование"),
    CONSTRUCTION("construction", "Строительство"),
    LAUNCH("launch", "Запуск");

    private final String code;
    private final String title;

    Stage(String code, String title) {
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
