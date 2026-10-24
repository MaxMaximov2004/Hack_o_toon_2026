package ru.rt.radar.common.exception;

import static ru.rt.radar.common.util.LogPatterns.TOO_LARGE_EXPORT;

/** Выгрузка больше лимита → 413 TOO_LARGE с details.total и details.limit. */
public class TooLargeException extends RuntimeException {

    private final long total;
    private final long limit;

    public TooLargeException(long total, long limit) {
        super(String.format(TOO_LARGE_EXPORT, total, limit));
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
