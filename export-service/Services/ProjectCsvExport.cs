using System.Globalization;
using System.Text;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using ExportService.Models;

namespace ExportService.Services
{
    /// <summary>
    /// Выгрузка инвестпроектов Навигатора (docs/tz/06-csharp-export.md, «Продукт 2»). Технические соглашения — как у
    /// компаний (CsvExport): UTF-8 с BOM, «;», \r\n, числа ru-RU без разделителя тысяч. Проектов десятки, но читаем
    /// так же потоком — одна схема на оба экспорта.
    /// </summary>
    public static class ProjectCsvExport
    {
        private static readonly CultureInfo Ru = CultureInfo.GetCultureInfo("ru-RU");
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private const string Source = "Инвестиционный навигатор";

        public static async Task<int> WriteAsync(Stream projectsJson, Stream output, string format, CancellationToken ct)
        {
            await using var writer = new StreamWriter(output, new UTF8Encoding(true), 1 << 16, leaveOpen: true);
            await using var csv = new CsvWriter(writer, new CsvConfiguration(Ru) { Delimiter = ";", NewLine = "\r\n" });
            var bitrix = format == "bitrix";
            var columns = bitrix
                ? new[] { "Название лида", "Название компании", "Рабочий телефон", "Рабочий e-mail", "Адрес", "Источник", "Комментарий" }
                : new[] { "Название", "Инициатор", "Муниципалитет", "Стадия", "Отрасль", "Потребности", "Что предложить",
                          "Год начала", "Год запуска", "Объём, млн руб.", "Рабочие места", "Ключевой проект", "Куратор", "Источник" };
            foreach (var column in columns)
            {
                csv.WriteField(column);
            }
            await csv.NextRecordAsync();

            int rows = 0;
            await foreach (var p in JsonSerializer.DeserializeAsyncEnumerable<ProjectDto>(projectsJson, Json, ct))
            {
                if (p == null)
                {
                    continue;
                }
                if (bitrix) WriteBitrixRow(csv, p); else WriteCsvRow(csv, p);
                await csv.NextRecordAsync();
                rows++;
            }
            await csv.FlushAsync();
            await writer.FlushAsync();
            return rows;
        }

        private static void WriteCsvRow(CsvWriter csv, ProjectDto p)
        {
            csv.WriteField(p.Title ?? "");
            csv.WriteField(p.Initiator ?? "");
            csv.WriteField(p.MunicipalityName ?? "");
            csv.WriteField(p.StageName ?? "");
            csv.WriteField(p.IndustryName ?? "");
            csv.WriteField(Needs(p));
            csv.WriteField(Offers(p));
            csv.WriteField(p.StartYear?.ToString(Ru) ?? "");
            csv.WriteField(p.LaunchYear?.ToString(Ru) ?? "");
            csv.WriteField(p.AmountMln?.ToString("0.##", Ru) ?? "");     // млн руб.: 230000, 12,5
            csv.WriteField(p.Jobs?.ToString(Ru) ?? "");
            csv.WriteField(p.IsKey ? "Да" : "Нет");
            csv.WriteField(p.Curator ?? "");
            csv.WriteField(Source);
        }

        /// <summary>Лид в Bitrix24: компания — инициатор проекта, в комментарии — всё, что нужно менеджеру для звонка.</summary>
        private static void WriteBitrixRow(CsvWriter csv, ProjectDto p)
        {
            csv.WriteField($"Инвестпроект: {p.Title}");
            csv.WriteField(p.Initiator ?? "");
            csv.WriteField("");
            csv.WriteField("");
            csv.WriteField(p.MunicipalityName ?? "");
            csv.WriteField(Source);
            var amount = p.AmountMln.HasValue ? $"{p.AmountMln.Value.ToString("0.##", Ru)} млн руб." : "нет данных";
            var years = p.StartYear.HasValue || p.LaunchYear.HasValue ? $"{p.StartYear}–{p.LaunchYear}" : "нет данных";
            csv.WriteField($"Стадия: {p.StageName}; отрасль: {p.IndustryName}; объём {amount}; рабочих мест {p.Jobs?.ToString(Ru) ?? "нет данных"}; "
                           + $"годы {years}; потребности: {Needs(p)}; предложить: {Offers(p)}");
        }

        private static string Needs(ProjectDto p) =>
            string.Join(", ", (p.RecommendedOffers ?? new()).Select(o => o.NeedName).Where(n => !string.IsNullOrEmpty(n)));

        /// <summary>«ИТ-инфраструктура и связь: VPN, облако; Физическая безопасность: видеонаблюдение» — по потребностям.</summary>
        private static string Offers(ProjectDto p) =>
            string.Join("; ", (p.RecommendedOffers ?? new())
                .Where(o => o.Offers is { Count: > 0 })
                .Select(o => $"{o.NeedName}: {string.Join(", ", o.Offers!)}"));
    }
}
