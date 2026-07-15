const LANG = {
    ru: {
        speed: "Скорость", distance: "Дистанция", time: "Время", total_km: "Всего км",
        history: "История", settings: "Настройки", name: "Имя", weight: "Вес (кг)",
        height: "Рост (см)", theme: "Тема", language: "Язык", line_color: "Цвет маршрута",
        ride_summary: "Итоги поездки", start: "Старт", pause: "Пауза", stop: "Стоп",
        save: "Сохранить", draw: "Рисовать", km: "км", min: "мин", cal: "ккал",
        profile: "Мой профиль", map: "Карта и отображение", interface: "Интерфейс и темы",
        sound: "Звук и голос", training: "Тренировки и мотивация", weather: "Погода и окружение",
        history_tab: "История и данные", achievements: "Достижения", integrations: "Интеграции",
        system: "Система и безопасность", elevation: "Высоты", ascent: "Подъём", descent: "Спуск", flat: "Ровно"
        
    },
    en: {
        speed: "Speed", distance: "Distance", time: "Time", total_km: "Total km",
        history: "History", settings: "Settings", name: "Name", weight: "Weight (kg)",
        height: "Height (cm)", theme: "Theme", language: "Language", line_color: "Route Color",
        ride_summary: "Ride Summary", start: "Start", pause: "Pause", stop: "Stop",
        save: "Save", draw: "Draw", km: "mi", min: "min", cal: "kcal",
        profile: "My Profile", map: "Map & Display", interface: "Interface & Themes",
        sound: "Sound & Voice", training: "Training & Motivation", weather: "Weather & Environment",
        history_tab: "History & Data", achievements: "Achievements", integrations: "Integrations",
        system: "System & Security", elevation: "Elevation", ascent: "Ascent", descent: "Descent", flat: "Flat"
    },
    ar: {
        speed: "السرعة", distance: "المسافة", time: "الوقت", total_km: "إجمالي كم",
        history: "التاريخ", settings: "الإعدادات", name: "الاسم", weight: "الوزن (كغم)",
        height: "الطول (سم)", theme: "المظهر", language: "اللغة", line_color: "لون المسار",
        ride_summary: "ملخص الرحلة", start: "ابدأ", pause: "إيقاف مؤقت", stop: "توقف",
        save: "حفظ", draw: "رسم", km: "كم", min: "دقيقة", cal: "سعرة",
        profile: "ملفي الشخصي", map: "الخريطة والعرض", interface: "الواجهة والمظاهر",
        sound: "الصوت والصوتيات", training: "التدريب والدافع", weather: "الطقس والبيئة",
        history_tab: "التاريخ والبيانات", achievements: "الإنجازات", integrations: "التكاملات",
        system: "النظام والأمان", elevation: "الارتفاع", ascent: "صعود", descent: "هبوط", flat: "مستو"
    }
};

let currentLang = 'ru';

function t(key) {
    return LANG[currentLang]?.[key] || key;
}
