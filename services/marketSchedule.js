const MarketSettings = require("../models/MarketSettings");

const MARKET_TIME_ZONE = "America/New_York";
const MARKET_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
});
const WEEKDAY_NUMBERS = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
};

function defaultHolidays() {
    const parts = MARKET_TIME_FORMATTER.formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === "year").value);
    return [year, year + 1].flatMap((holidayYear) => [
        `${holidayYear}-01-01`,
        `${holidayYear}-07-04`,
        `${holidayYear}-12-25`
    ]);
}

async function getMarketSettings() {
    return MarketSettings.findOneAndUpdate(
        { key: "default" },
        {
            $setOnInsert: {
                opens_at: "09:30",
                closes_at: "16:00",
                trading_days: [1, 2, 3, 4, 5],
                holidays: defaultHolidays()
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
}

function currentMarketTime(settings, fallback = new Date()) {
    if (!settings.clock_override) return fallback;
    const elapsed = settings.clock_override_started_at
        ? Math.max(0, Date.now() - settings.clock_override_started_at.getTime())
        : 0;
    return new Date(settings.clock_override.getTime() + elapsed);
}

function isMarketOpen(settings, date = new Date()) {
    date = currentMarketTime(settings, date);
    const parts = Object.fromEntries(
        MARKET_TIME_FORMATTER.formatToParts(date).map((part) => [part.type, part.value])
    );
    const marketDate = `${parts.year}-${parts.month}-${parts.day}`;
    const day = WEEKDAY_NUMBERS[parts.weekday];
    if (!settings.trading_days.includes(day) || settings.holidays.includes(marketDate)) {
        return false;
    }

    const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
    const [openHour, openMinute] = settings.opens_at.split(":").map(Number);
    const [closeHour, closeMinute] = settings.closes_at.split(":").map(Number);
    return currentMinutes >= openHour * 60 + openMinute &&
        currentMinutes < closeHour * 60 + closeMinute;
}

function publicMarketSettings(settings) {
    const now = currentMarketTime(settings);
    const parts = Object.fromEntries(
        MARKET_TIME_FORMATTER.formatToParts(now).map((part) => [part.type, part.value])
    );
    return {
        opens_at: settings.opens_at,
        closes_at: settings.closes_at,
        trading_days: settings.trading_days,
        holidays: settings.holidays,
        time_zone: MARKET_TIME_ZONE,
        current_datetime: now.toISOString(),
        current_market_date: `${parts.year}-${parts.month}-${parts.day}`,
        clock_overridden: Boolean(settings.clock_override),
        is_open: isMarketOpen(settings, now)
    };
}

module.exports = {
    currentMarketTime,
    getMarketSettings,
    isMarketOpen,
    publicMarketSettings
};
