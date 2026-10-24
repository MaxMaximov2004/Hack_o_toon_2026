package ru.rt.radar.radar.filter;

/** Параметр фильтра client: все / только наши (is_client) / только не наши. */
public enum ClientMode implements CodedEnum {
    ALL("all", "Все"),
    OURS("ours", "Только клиенты РТ"),
    OTHERS("others", "Только не клиенты РТ");

    private final String code;
    private final String title;

    ClientMode(String code, String title) {
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
