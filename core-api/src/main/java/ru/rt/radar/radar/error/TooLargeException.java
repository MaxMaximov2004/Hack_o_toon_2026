package ru.rt.radar.radar.error;

// TEMP: заменить на common/ (Java #2)
/** Выгрузка больше лимита → 413 TOO_LARGE с details.total. */
public class TooLargeException extends RuntimeException {

    private final long total;
    private final long limit;

    public TooLargeException(long total, long limit) {
        super("Найдено " + total + " компаний, больше лимита " + limit + " — сузьте фильтр");
        this.total = total;
        this.limit = limit;
    }

    public long getTotal() {
        return total;
    }

    public long getLimit() {
        return limit;
    }
}
