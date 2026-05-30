export const fmt = {
  num(v: number | null | undefined, d = 0): string {
    if (v == null || isNaN(v)) return "\u2014";
    return Number(v).toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  },
  date(s: string | Date, opt?: Intl.DateTimeFormatOptions): string {
    return new Date(s).toLocaleDateString(
      "en-US",
      opt || { month: "short", day: "numeric" }
    );
  },
  dateTime(s: string): string {
    return new Date(s).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  },
  relDay(s: string): string {
    const d = Math.round((Date.now() - new Date(s).getTime()) / 86400000);
    if (d <= 0) return "Today";
    if (d === 1) return "Yesterday";
    if (d < 7) return d + " days ago";
    return new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  },
};
