namespace ExportService.Models
{
    /// <summary>Единый формат ошибок всех сервисов: { "error": { "code", "message", "details" } } (00-common).</summary>
    public record ErrorResponse(ErrorDetails error)
    {
        public static ErrorResponse Of(string code, string message, object? details = null) =>
            new(new ErrorDetails(code, message, details));
    }

    public record ErrorDetails(string code, string message, object? details);
}
