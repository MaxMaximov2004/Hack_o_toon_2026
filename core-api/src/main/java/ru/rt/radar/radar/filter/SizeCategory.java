package ru.rt.radar.radar.filter;

/** Категория субъекта МСП. */
public enum SizeCategory implements CodedEnum {
    MICRO("micro", "Микропредприятие"),
    SMALL("small", "Малое"),
    MEDIUM("medium", "Среднее");

    private final String code;
    private final String title;

    SizeCategory(String code, String title) {
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
