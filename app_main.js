// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let map, routeLine;
let myPlacemark = null; // метка "Я" для текущего местоположения
let elevationSegments = []; // для хранения сегментов карты высот
let isRecording = false, isPaused = false, isManualMode = false, isSplash = true;
let points = [], timerInterval, elapsedSeconds = 0;
let totalDistance = 0, currentSpeed = 0, maxSpeed = 0;
let watchId = null, startTime, isAppActive = false;
let routeHistory = JSON.parse(localStorage.getItem('bike_routes')) || [];
let userSettings = JSON.parse(localStorage.getItem('bike_settings')) || {
    name: 'Гонщик', weight: 70, height: 175, age: 30, bike: 'hybrid',
    theme: 'dark', lang: 'ru', color: '#00ffcc', lineWidth: 4,
    voice: true, voiceFreq: '5', startSound: true, vibration: true,
    dailyGoal: 0, autoPause: true, tempUnit: 'C', streetView: true,
    layer: 'scheme', fontSize: 'medium'
};
let odoTotal = 0, currentRouteId = null;
const MOTIVATION = {
    ru: ["Ты просто машина! Крути дальше!","5 км позади, пульс в норме, продолжай!","Рекордный темп! Сегодня ветер твой друг.","Отличный ритм, не сбавляй обороты!","Ещё немного и ты покоришь новую вершину!","Красота! Ты создан для велосипеда.","10 километров! Цель близка, жми!","Ого, да ты летишь! Фантастика!"],
    en: ["You're a machine! Keep going!","5km down, heart rate normal, push on!","Record pace! The wind is your friend today.","Great rhythm, don't slow down!","A little more and you'll conquer a new peak!","Beautiful! You were born for this.","10km! The goal is near, pedal hard!","Whoa, you're flying! Fantastic!"],
    ar: ["أنت آلة! استمر!","5 كم خلفك، نبضك طبيعي، تابع!","سرعة قياسية! الرياح صديقتك اليوم.","إيقاع رائع، لا تبطئ!","القليل وسنغزو قمة جديدة!","جميل! لقد خلقت للدراجات.","10 كم! الهدف قريب، دوّس بقوة!","واو، أنت تطير! رائع!"]
};

// --- ИНИЦИАЛИЗАЦИЯ КАРТЫ С ЦЕНТРИРОВАНИЕМ ПО GPS И МЕТКОЙ "Я" ---
ymaps.ready(function() {
    // Сначала создаём карту с центром по умолчанию (Казань) и тёмной темой
    map = new ymaps.Map('map', {
        center: [55.7961, 49.1064],
        zoom: 13,
        controls: ['zoomControl', 'geolocationControl'],
        // Включаем тёмную тему (если поддерживается)
        behaviors: ['default', 'scrollZoom']
    });
    // Применяем тёмную тему, если пользователь выбрал тёмную тему
    if (userSettings.theme === 'dark') {
        map.setType('yandex#map');
        // Для тёмной темы карты используем специальный стиль через CSS
        document.getElementById('map').style.filter = 'invert(0.9) hue-rotate(180deg)';
    } else {
        document.getElementById('map').style.filter = 'none';
    }

    // Добавляем кнопку геолокации
    map.controls.add('geolocationControl', { float: 'left' });

    // Создаём метку "Я" (будет обновляться при получении GPS)
    myPlacemark = new ymaps.Placemark([55.7961, 49.1064], {
        iconContent: 'Я'
    }, {
        preset: 'islands#blueStretchyIcon',
        iconColor: '#00cc99'
    });
    map.geoObjects.add(myPlacemark);

    // Пытаемся определить текущее местоположение и центрировать карту
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            // Обновляем метку и центрируем карту
            myPlacemark.geometry.setCoordinates([lat, lng]);
            map.setCenter([lat, lng], 15, { duration: 500 });
        }, function(err) {
            console.warn('Не удалось определить местоположение:', err);
            // Если GPS недоступен, оставляем Казань
        }, { enableHighAccuracy: true, timeout: 10000 });
    }

    // Обработчик кликов для маршрутизации (проверяет флаг isRoutingMode)
    map.events.add('click', function(e) {
        if (isRoutingMode) {
            const coords = e.get('coords');
            addRoutingPoint(coords[0], coords[1]);
            document.getElementById('routing-points-count').textContent = `Точек: ${routingPoints.length}`;
        }
    });

    // Загрузка сохранённых POI (если есть)
    loadPOIs();
});

// --- ФУНКЦИИ ВХОДА И НАВИГАЦИИ ---
function enterApp() {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    isSplash = false;
    applySettings();
    updateHistoryUI();
    updateProgressBar();
    setTimeout(() => { if (map && map.container) { try { map.container.fitToViewport(); } catch(e) {} } }, 400);
}
function exitToSplash() {
    if(isRecording) stopRecording(); toggleSidebar();
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('splash-screen').style.display = 'flex'; isSplash = true;
    showToast('До новых встреч, гонщик!');
}
function openStatsFromSplash() {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block'; isSplash = false;
    applySettings(); updateHistoryUI(); updateProgressBar();
    setTimeout(() => { if (map && map.container) { try { map.container.fitToViewport(); } catch(e) {} } openStatsFromSidebar(); }, 400);
}
function openSettingsFromSplash() {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block'; isSplash = false;
    applySettings(); updateHistoryUI(); updateProgressBar();
    setTimeout(() => { if (map && map.container) { try { map.container.fitToViewport(); } catch(e) {} } openSettings(); }, 400);
}

function toggleSidebar() { document.getElementById('main-sidebar').classList.toggle('hidden'); }
function openSettings() { toggleSidebar(); document.getElementById('settings-sidebar').classList.remove('hidden'); document.getElementById('settings-menu-list').style.display = 'flex'; document.getElementById('settings-tab-content').style.display = 'none'; }
function closeSettings() { document.getElementById('settings-sidebar').classList.add('hidden'); }
function openSettingsTab(tab) {
    document.getElementById('settings-menu-list').style.display = 'none';
    const content = document.getElementById('settings-tab-content');
    content.style.display = 'flex'; content.innerHTML = getTabHTML(tab);
}

// --- НАЧАЛО getTabHTML (профиль, карта, звук, погода, история, система, интерфейс, тренировки) ---
function getTabHTML(tab) {
    const s = userSettings; let html = `<button class="back-btn" onclick="closeSettingsTab()">◀ Назад</button><h3 style="margin-bottom:10px;">${t(tab)}</h3>`;
    if(tab === 'profile') {
        html += `<label>${t('name')}</label><input type="text" id="s-name" value="${s.name}"><label>${t('weight')}</label><input type="number" id="s-weight" value="${s.weight}"><label>${t('height')}</label><input type="number" id="s-height" value="${s.height}"><label>Возраст</label><input type="number" id="s-age" value="${s.age}"><label>Тип велосипеда</label><select id="s-bike"><option value="mtb" ${s.bike=='mtb'?'selected':''}>Горный</option><option value="road" ${s.bike=='road'?'selected':''}>Шоссейный</option><option value="hybrid" ${s.bike=='hybrid'?'selected':''}>Гибрид</option></select><button class="save-btn" onclick="saveSettingsTab('profile')">💾 Сохранить</button>`;
    } else if(tab === 'map') {
        html += `<label>Слой карты</label><select id="s-layer"><option value="scheme" ${s.layer=='scheme'?'selected':''}>Схема</option><option value="satellite" ${s.layer=='satellite'?'selected':''}>Спутник</option></select><label>Цвет маршрута</label><input type="color" id="s-color" value="${s.color}"><label>Толщина линии</label><input type="range" id="s-width" min="2" max="8" value="${s.lineWidth}"><label>Показать компас</label><select id="s-compass"><option value="true" ${s.compass?'selected':''}>Да</option><option value="false" ${!s.compass?'selected':''}>Нет</option></select><button class="save-btn" onclick="saveSettingsTab('map')">💾 Сохранить</button>`;
    } else if(tab === 'sound') {
        html += `<label>Озвучивание событий</label><select id="s-voice"><option value="true" ${s.voice?'selected':''}>Вкл</option><option value="false" ${!s.voice?'selected':''}>Выкл</option></select><label>Частота подсказок (км)</label><select id="s-voicefreq"><option value="1" ${s.voiceFreq=='1'?'selected':''}>1 км</option><option value="5" ${s.voiceFreq=='5'?'selected':''}>5 км</option><option value="10" ${s.voiceFreq=='10'?'selected':''}>10 км</option><option value="end" ${s.voiceFreq=='end'?'selected':''}>Только финиш</option></select><label>Звук старта (Бип)</label><select id="s-startsound"><option value="true" ${s.startSound?'selected':''}>Вкл</option><option value="false" ${!s.startSound?'selected':''}>Выкл</option></select><label>Вибрация кнопок</label><select id="s-vibration"><option value="true" ${s.vibration?'selected':''}>Вкл</option><option value="false" ${!s.vibration?'selected':''}>Выкл</option></select><button class="save-btn" onclick="saveSettingsTab('sound')">💾 Сохранить</button>`;
    } else if(tab === 'weather') {
        html += `<label>Авто-погода при старте</label><select id="s-autoweather"><option value="true" ${s.autoWeather?'selected':''}>Вкл</option><option value="false" ${!s.autoWeather?'selected':''}>Выкл</option></select><label>Прогноз на завтра</label><select id="s-forecast"><option value="true" ${s.forecast?'selected':''}>Вкл</option><option value="false" ${!s.forecast?'selected':''}>Выкл</option></select><label>Показывать улицу</label><select id="s-streetview"><option value="true" ${s.streetView?'selected':''}>Вкл</option><option value="false" ${!s.streetView?'selected':''}>Выкл</option></select><button class="save-btn" onclick="saveSettingsTab('weather')">💾 Сохранить</button>`;
    } else if(tab === 'history') {
        html += `<h4>Управление историей</h4><button class="save-btn" onclick="toggleMultiDeleteMode()">✏️ Выбрать несколько маршрутов</button><button class="save-btn" onclick="deleteSingleRoute()">🗑️ Удалить один маршрут</button><button class="save-btn red-text" onclick="clearAllRoutes()">⚠️ Очистить всё</button><button class="save-btn" onclick="exportAllGPX()">📤 Экспорт всех GPX (ZIP)</button><button class="save-btn" onclick="importGPX()">📥 Импорт GPX</button>`;
    } else if(tab === 'system') {
        html += `<h4>Система</h4><label>Экстренная кнопка (SOS)</label><select id="s-sos"><option value="true" ${s.sos?'selected':''}>Вкл</option><option value="false" ${!s.sos?'selected':''}>Выкл</option></select><label>Контакт для SOS</label><input type="text" id="s-soscontact" value="${s.sosContact||''}"><button class="save-btn" onclick="saveSettingsTab('system')">💾 Сохранить</button><button class="save-btn red-text" onclick="resetApp()">⚠️ Сброс до заводских</button>`;
    } else if(tab === 'interface') {
        html += `<label>Тема оформления</label><select id="s-theme"><option value="dark" ${s.theme==='dark'?'selected':''}>🌙 Тёмная</option><option value="light" ${s.theme==='light'?'selected':''}>☀️ Светлая</option></select><label>Язык интерфейса</label><select id="s-lang"><option value="ru" ${s.lang==='ru'?'selected':''}>Русский</option><option value="en" ${s.lang==='en'?'selected':''}>English</option><option value="ar" ${s.lang==='ar'?'selected':''}>العربية</option></select><label>Цвет маршрута</label><input type="color" id="s-color" value="${s.color}"><label>Размер шрифта на табло</label><select id="s-fontsize"><option value="small" ${s.fontSize==='small'?'selected':''}>Мелкий</option><option value="medium" ${s.fontSize==='medium'?'selected':''}>Средний</option><option value="large" ${s.fontSize==='large'?'selected':''}>Крупный</option></select><button class="save-btn" onclick="saveSettingsTab('interface')">💾 Сохранить</button>`;
    } else if(tab === 'training') {
        const totalKm = routeHistory.reduce((sum, r) => sum + r.distance, 0);
        const totalCal = routeHistory.reduce((sum, r) => sum + r.calories, 0);
        const bestDistance = routeHistory.length > 0 ? Math.max(...routeHistory.map(r => r.distance)) : 0;
        const bestAvgSpeed = routeHistory.length > 0 ? Math.max(...routeHistory.map(r => r.avgSpeed)) : 0;
        const totalClimb = routeHistory.reduce((sum, r) => {
            let climb = 0;
            if (r.points && r.points.length > 1) {
                for (let i = 1; i < r.points.length; i++) {
                    const diff = (r.points[i].alt || 0) - (r.points[i-1].alt || 0);
                    if (diff > 0) climb += diff;
                }
            }
            return sum + climb;
        }, 0);
        html += `<label>Цель на сегодня (км)</label><input type="number" id="s-dailygoal" value="${s.dailyGoal || 0}"><button class="save-btn" onclick="saveSettingsTab('training')">💾 Сохранить цель</button><hr><h4>📈 Прогресс за сегодня</h4><p>Проехано: <span id="today-distance">0</span> км</p><div style="background:#222; height:10px; border-radius:5px; width:100%;"><div id="progress-bar" style="background:var(--accent-grad); height:100%; border-radius:5px; width:0%;"></div></div><hr><h4>🏆 Личные рекорды</h4><p>Самая длинная поездка: <b>${bestDistance.toFixed(1)} км</b></p><p>Максимальная средняя скорость: <b>${bestAvgSpeed.toFixed(1)} км/ч</b></p><p>Суммарный набор высоты: <b>${totalClimb.toFixed(0)} м</b></p><p>Всего калорий: <b>${totalCal.toFixed(0)} ккал</b></p>`;
        } else if(tab === 'achievements') {
        const achievements = calculateAchievements(routeHistory);
        html += `<h4>🏅 Мои достижения</h4><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;">`;
        achievements.forEach(ach => {
            const isUnlocked = ach.unlocked;
            html += `
                <div style="background:${isUnlocked ? 'var(--accent-grad)' : 'rgba(255,255,255,0.05)'}; 
                            padding:15px; border-radius:16px; min-width:120px; text-align:center; 
                            opacity:${isUnlocked ? 1 : 0.4}; flex:1;">
                    <div style="font-size:28px;">${ach.icon}</div>
                    <div style="font-size:14px; font-weight:bold; margin-top:5px;">${ach.title}</div>
                    <div style="font-size:11px;">${isUnlocked ? '✅ Получено!' : '🔒 Ещё не получено'}</div>
                </div>
            `;
        });
        html += `</div>`;
    } else if(tab === 'integrations') {
        html += `
            <h4>📤 Поделиться маршрутом</h4>
            <p style="font-size:13px; opacity:0.8;">Поделиться текущим маршрутом через мессенджеры</p>
            <button class="save-btn" onclick="shareCurrentRoute()">📲 Поделиться</button>
            
            <h4 style="margin-top:15px;">🌍 Экспорт в KML (Google Earth)</h4>
            <button class="save-btn" onclick="exportKML()">📤 Скачать KML</button>

            <h4 style="margin-top:15px;">💾 Бэкап данных (JSON)</h4>
            <button class="save-btn" onclick="exportBackup()">💾 Скачать бэкап</button>
            <button class="save-btn" onclick="document.getElementById('json-import-input').click()">📂 Загрузить бэкап</button>
            <input type="file" id="json-import-input" accept=".json" style="display:none;" onchange="importBackup(event)">
        `;
    } else if(tab === 'routing') {
        html += `
            <h4>🚴 Маршрутизация (OSRM)</h4>
            <p style="font-size:13px; opacity:0.8;">Строить маршруты с промежуточными точками и цветной картой высот.</p>
            <button class="save-btn" onclick="openRouting()">🗺️ Открыть планировщик</button>
        `;
    } else if(tab === 'poi') {
        // Вкладка для управления сохранёнными точками (POI)
        const pois = JSON.parse(localStorage.getItem('bike_pois')) || [];
        html += `<h4>📍 Мои точки (POI)</h4><p style="font-size:13px; opacity:0.8;">Сохраняй важные места и строй через них маршруты.</p>`;
        if (pois.length === 0) {
            html += `<p style="opacity:0.6;">У тебя пока нет сохранённых точек. Нажми "Добавить точку" на карте в режиме маршрутизации.</p>`;
        } else {
            html += `<div style="display:flex;flex-direction:column;gap:8px;">`;
            pois.forEach((poi, idx) => {
                html += `
                    <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <b>${poi.name || 'Без названия'}</b>
                            <div style="font-size:12px; opacity:0.6;">${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}</div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="save-btn" onclick="buildRouteToPOI(${idx})">🚴 Построить</button>
                            <button class="save-btn red-text" onclick="deletePOI(${idx})">🗑️</button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += `<button class="save-btn" onclick="addPOI()">➕ Добавить точку на карте</button>`;
    } else {
        html += `<p>Настройки для этой вкладки в разработке</p>`;
    }
    return html;
}

function closeSettingsTab() {
    document.getElementById('settings-menu-list').style.display = 'flex';
    document.getElementById('settings-tab-content').style.display = 'none';
}

function saveSettingsTab(tab) {
    const s = userSettings;
    if(tab === 'profile') {
        s.name = document.getElementById('s-name').value;
        s.weight = parseFloat(document.getElementById('s-weight').value) || 70;
        s.height = parseFloat(document.getElementById('s-height').value) || 175;
        s.age = parseInt(document.getElementById('s-age').value) || 30;
        s.bike = document.getElementById('s-bike').value;
    } else if(tab === 'map') {
        s.layer = document.getElementById('s-layer').value;
        s.color = document.getElementById('s-color').value;
        s.lineWidth = parseInt(document.getElementById('s-width').value);
        s.compass = document.getElementById('s-compass').value === 'true';
        toggleMapLayer(s.layer);
    } else if(tab === 'sound') {
        s.voice = document.getElementById('s-voice').value === 'true';
        s.voiceFreq = document.getElementById('s-voicefreq').value;
        s.startSound = document.getElementById('s-startsound').value === 'true';
        s.vibration = document.getElementById('s-vibration').value === 'true';
    } else if(tab === 'weather') {
        s.autoWeather = document.getElementById('s-autoweather').value === 'true';
        s.forecast = document.getElementById('s-forecast').value === 'true';
        s.streetView = document.getElementById('s-streetview').value === 'true';
    } else if(tab === 'system') {
        s.sos = document.getElementById('s-sos').value === 'true';
        s.sosContact = document.getElementById('s-soscontact').value;
    } else if(tab === 'interface') {
        s.theme = document.getElementById('s-theme').value;
        s.lang = document.getElementById('s-lang').value;
        s.color = document.getElementById('s-color').value;
        s.fontSize = document.getElementById('s-fontsize').value;
    } else if(tab === 'training') {
        s.dailyGoal = parseFloat(document.getElementById('s-dailygoal').value) || 0;
    }
    localStorage.setItem('bike_settings', JSON.stringify(s));
    applySettings();
    showToast('Настройки сохранены!');
    closeSettingsTab();
}
function toggleMapLayer(layer) {
    if(!map) return;
    map.setType(layer === 'satellite' ? 'yandex#satellite' : 'yandex#map');
}

function applySettings() {
    const s = userSettings;
    currentLang = s.lang;
    document.body.classList.toggle('light-theme', s.theme === 'light');
    const colorEl = document.getElementById('route-color');
    if(colorEl) colorEl.value = s.color;
    document.getElementById('top-panel').className = 'font-' + (s.fontSize || 'medium');
    applyLanguage();
    if (s.layer) toggleMapLayer(s.layer);

    // Управление видимостью SOS-кнопки
    const sosBtn = document.getElementById('sos-btn');
    if(sosBtn) {
        sosBtn.style.display = s.sos ? 'flex' : 'none';
    }

    // Применяем тёмную тему для карты, если выбрана тёмная тема
    const mapElement = document.getElementById('map');
    if (mapElement) {
        if (s.theme === 'dark') {
            mapElement.style.filter = 'invert(0.9) hue-rotate(180deg)';
        } else {
            mapElement.style.filter = 'none';
        }
    }
}

function applyLanguage() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.dataset.lang;
        el.textContent = t(key);
    });
}

function updateProgressBar() {
    const today = new Date().toLocaleDateString();
    const todayRoutes = routeHistory.filter(r => new Date(r.date).toLocaleDateString() === today);
    const todayDistance = todayRoutes.reduce((sum, r) => sum + r.distance, 0);
    const el = document.getElementById('today-distance');
    if(el) el.textContent = todayDistance.toFixed(1);
    const goal = userSettings.dailyGoal || 0;
    const progress = goal > 0 ? Math.min((todayDistance / goal) * 100, 100) : 0;
    const bar = document.getElementById('progress-bar');
    if(bar) bar.style.width = progress + '%';
}

// --- ЗАПИСЬ GPS ---
function startRecording() {
    if(isRecording) return;
    if(!navigator.geolocation) { showToast('GPS недоступен'); return; }
    isRecording = true; isPaused = false; isManualMode = false;
    points = []; totalDistance = 0; elapsedSeconds = 0; maxSpeed = 0;
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-pause').style.display = 'flex';
    document.getElementById('btn-stop').style.display = 'flex';
    document.getElementById('btn-save').style.display = 'none';

    if(userSettings.startSound) playBeep();
    if(userSettings.vibration) navigator.vibrate(100);
    if(userSettings.autoWeather) updateWeather();

    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    
    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            if(isPaused) return;
            const lat = pos.coords.latitude, lng = pos.coords.longitude;
            currentSpeed = pos.coords.speed * 3.6 || 0;
            if(currentSpeed > maxSpeed) maxSpeed = currentSpeed;
            document.getElementById('speed-display').textContent = currentSpeed.toFixed(1);
            
            // Обновляем метку "Я" при каждом обновлении GPS
            if(myPlacemark) {
                myPlacemark.geometry.setCoordinates([lat, lng]);
            }

            if(points.length > 0) {
                const last = points[points.length - 1];
                const d = haversine(last.lat, last.lng, lat, lng);
                totalDistance += d;
                document.getElementById('distance-display').textContent = totalDistance.toFixed(2);
                if(userSettings.autoPause && currentSpeed < 0.5 && elapsedSeconds > 10 && !isPaused) togglePause(true);
                else if(userSettings.autoPause && currentSpeed > 2 && isPaused) togglePause(false);
            }
            points.push({lat, lng, alt: pos.coords.altitude || 0});
            drawRoute();
            if(userSettings.streetView) geocodeStreet(lat, lng);
            checkMotivation();
        },
        (err) => console.warn(err),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
    // Очищаем очередь перед новым голосом
    if('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    speakText(t('start'));
}

function drawRoute() {
    if(routeLine) map.geoObjects.remove(routeLine);
    if(points.length < 2) return;
    const coords = points.map(p => [p.lat, p.lng]);
    routeLine = new ymaps.Polyline(coords, {
        strokeColor: userSettings.color,
        strokeWidth: userSettings.lineWidth || 4,
        strokeOpacity: 0.9
    });
    map.geoObjects.add(routeLine);
}
// --- МОТИВАЦИЯ И ГОЛОС ---
let lastMotivationKm = 0;
function checkMotivation() {
    if(!userSettings.voice) return;
    const freq = parseInt(userSettings.voiceFreq) || 5;
    if(totalDistance - lastMotivationKm >= freq) {
        lastMotivationKm = totalDistance;
        const phrase = `Проехал ${totalDistance.toFixed(0)} километров!`;
        // Очищаем очередь перед новым голосом
        if('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        speakText(phrase);
    }
}

function speakText(text) {
    if(!userSettings.voice) return;
    if('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLang === 'ru' ? 'ru-RU' : 'en-US';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 800; gain.gain.value = 0.3;
        osc.start(); setTimeout(() => { osc.stop(); }, 150);
    } catch(e) {}
}

// --- РУЧНОЕ РИСОВАНИЕ ---
function enableManualDraw() {
    if(isRecording) return;
    isManualMode = !isManualMode;
    if(isManualMode) {
        points = [];
        document.getElementById('btn-manual').style.background = '#ffb700';
        document.getElementById('btn-undo').style.display = 'flex';
        document.getElementById('btn-clear').style.display = 'flex';
        // Сначала удаляем старый обработчик, чтобы не было дублей
        map.events.remove('click');
        map.events.add('click', (e) => {
            const coords = e.get('coords');
            points.push({lat: coords[0], lng: coords[1], alt: 0});
            drawRoute();
        });
    } else {
        map.events.remove('click');
        document.getElementById('btn-manual').style.background = '';
        document.getElementById('btn-undo').style.display = 'none';
        document.getElementById('btn-clear').style.display = 'none';
        if(points.length > 0) {
            totalDistance = 0;
            for(let i=1; i<points.length; i++) {
                totalDistance += haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
            }
            document.getElementById('distance-display').textContent = totalDistance.toFixed(2);
            document.getElementById('btn-save').style.display = 'flex';
            // Очищаем очередь перед новым голосом
            if('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            speakText('Маршрут нарисован');
        }
    }
}

function undoLastPoint() {
    if(points.length > 0) { points.pop(); drawRoute(); showToast('Точка удалена'); }
}

function clearManualRoute() {
    if(points.length > 0) { points = []; drawRoute(); showToast('Маршрут очищен'); document.getElementById('btn-save').style.display = 'none'; }
}

// --- ПАУЗА И СТОП ---
function togglePause(force) {
    if(!isRecording) return;
    isPaused = force !== null ? force : !isPaused;
    document.getElementById('btn-pause').textContent = isPaused ? '▶️' : '⏸';
    // Очищаем очередь перед новым голосом
    if('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    if(isPaused) speakText('Пауза');
    else speakText('Продолжаем');
}

function stopRecording() {
    if(isRecording) {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(timerInterval);
        isRecording = false;
        document.getElementById('btn-start').style.display = 'flex';
        document.getElementById('btn-pause').style.display = 'none';
        document.getElementById('btn-stop').style.display = 'none';
        document.getElementById('btn-save').style.display = 'flex';
        // Очищаем очередь перед новым голосом
        if('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        speakText('Поездка завершена');
        showSummary();
    }
}

// --- СОХРАНЕНИЕ ---
function saveRoute() {
    if(points.length < 2) return showToast('Нет точек для сохранения');
    const cal = calcCalories(totalDistance, elapsedSeconds);
    const route = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        points: points,
        distance: totalDistance,
        time: elapsedSeconds,
        avgSpeed: elapsedSeconds>0?(totalDistance/(elapsedSeconds/3600)):0,
        maxSpeed: maxSpeed,
        calories: cal,
        color: userSettings.color,
        weather: document.getElementById('weather-temp').textContent + ' ' + document.getElementById('weather-icon').textContent,
        layer: userSettings.layer
    };
    routeHistory.push(route);
    localStorage.setItem('bike_routes', JSON.stringify(routeHistory));
    document.getElementById('btn-save').style.display = 'none';
    updateHistoryUI();
    updateProgressBar();
    showToast('✅ Маршрут сохранен!');
    speakText('Маршрут сохранен');
    document.getElementById('settings-tab-content').innerHTML = getTabHTML('achievements');
}

// --- ИТОГИ ---
function showSummary() {
    const modal = document.getElementById('finish-modal');
    const div = document.getElementById('summary-data');
    const avg = elapsedSeconds>0?(totalDistance/(elapsedSeconds/3600)):0;
    const cal = calcCalories(totalDistance, elapsedSeconds);
    div.innerHTML = `
        <p><b>${t('distance')}:</b> ${totalDistance.toFixed(2)} ${t('km')}</p>
        <p><b>${t('time')}:</b> ${formatTime(elapsedSeconds)}</p>
        <p><b>${t('speed')}:</b> ${avg.toFixed(1)} ${t('km')}/ч</p>
        <p><b>Макс. скорость:</b> ${maxSpeed.toFixed(1)} ${t('km')}/ч</p>
        <p><b>${t('cal')}:</b> ${cal} ${t('cal')}</p>
        <p><b>Погода:</b> ${document.getElementById('weather-temp').textContent}</p>
    `;
    setTimeout(() => drawHeightChart({points}), 100);
    modal.classList.remove('hidden');
}

// --- КАРТА ВЫСОТ (цветная заливка, теперь работает и для ручных) ---
function drawHeightChart(route) {
    const canvas = document.getElementById('height-chart');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 120;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!route.points || route.points.length<2) return;
    const heights = route.points.map(p => p.alt || 0);
    // Если все высоты нулевые, выводим сообщение
    if (heights.every(h => h === 0)) {
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Нет данных о высоте (запиши через GPS)', canvas.width/2, canvas.height/2);
        return;
    }
    const minH = Math.min(...heights), maxH = Math.max(...heights), range = maxH-minH || 1;
    const pad = 10;
    const graphW = canvas.width - pad*2;
    const graphH = canvas.height - pad*2 - 20;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(pad, pad, graphW, graphH);
    for (let i = 0; i < heights.length - 1; i++) {
        const x1 = pad + (i/(heights.length-1))*graphW;
        const y1 = pad + graphH - ((heights[i]-minH)/range)*graphH;
        const x2 = pad + ((i+1)/(heights.length-1))*graphW;
        const y2 = pad + graphH - ((heights[i+1]-minH)/range)*graphH;
        const diff = heights[i+1] - heights[i];
        let color;
        if (diff > 2) color = 'rgba(255,80,80,0.7)';
        else if (diff < -2) color = 'rgba(80,255,80,0.7)';
        else color = 'rgba(100,150,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, pad + graphH);
        ctx.lineTo(x1, pad + graphH);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
    // Линия поверх
    ctx.beginPath();
    for (let i=0; i<heights.length; i++) {
        const x = pad + (i/(heights.length-1))*graphW;
        const y = pad + graphH - ((heights[i]-minH)/range)*graphH;
        if(i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Легенда
    const legendY = canvas.height - 10;
    const legendItems = [
        {color:'rgba(255,80,80,0.9)', label:'Подъём'},
        {color:'rgba(80,255,80,0.9)', label:'Спуск'},
        {color:'rgba(100,150,255,0.9)', label:'Ровно'}
    ];
    let legendX = pad;
    legendItems.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY-12, 12, 12);
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(item.label, legendX+16, legendY);
        legendX += ctx.measureText(item.label).width + 26;
    });
    let ascent=0, descent=0;
    for (let i=1; i<heights.length; i++) {
        const diff = heights[i] - heights[i-1];
        if(diff>0) ascent += diff;
        else if(diff<0) descent += Math.abs(diff);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`⬆ ${Math.round(ascent)}м  ⬇ ${Math.round(descent)}м`, canvas.width - pad, legendY);
}
// --- Переключатель карты высот (исправление) ---
let elevationLayerEnabled = false;
function toggleElevationLayer() {
    // Удаляем старые сегменты при переключении
    elevationSegments.forEach(seg => map.geoObjects.remove(seg));
    elevationSegments = [];

    elevationLayerEnabled = !elevationLayerEnabled;
    const legend = document.getElementById('elevation-legend');
    const icon = document.getElementById('elevation-icon');
    const label = document.getElementById('elevation-label');
    
    if (elevationLayerEnabled) {
        legend.style.display = 'flex';
        icon.textContent = '⛰️✅';
        label.textContent = 'Высоты: вкл';
        if (points.length > 0) drawRouteWithElevation(points);
    } else {
        legend.style.display = 'none';
        icon.textContent = '⛰️';
        label.textContent = 'Высоты';
        if (points.length > 0) drawRoute();
    }
}
// --- ПОГОДА И ГЕОКОДИНГ ---
function updateWeather() {
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const {latitude, longitude} = pos.coords;
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=edd587a4978a7a8b772bac0871b3ed6d`;
        try {
            const resp = await fetch(url); const data = await resp.json();
            document.getElementById('weather-temp').textContent = Math.round(data.main.temp) + '°C';
            document.getElementById('weather-icon').textContent = data.weather[0].icon.includes('n') ? '🌙' : data.weather[0].icon.includes('01') ? '☀️' : '☁️';
        } catch(e) { document.getElementById('weather-temp').textContent = '--°C'; }
    });
}

function geocodeStreet(lat, lng) {
    ymaps.geocode([lat, lng]).then(res => {
        const first = res.geoObjects.get(0);
        if(first) {
            const name = first.getThoroughfare() || first.getAddressLine();
            document.getElementById('street-name').textContent = name || '';
        } else {
            document.getElementById('street-name').textContent = '';
        }
    });
}

// --- МАТЕМАТИКА ---
function calcCalories(km, seconds) {
    const weight = userSettings.weight || 70;
    const hours = seconds / 3600;
    const speed = hours > 0 ? km / hours : 0;
    let met = 4.0;
    if(speed > 20) met = 8.0; else if(speed > 15) met = 6.0; else if(speed > 10) met = 4.0; else met = 3.0;
    return Math.round(met * weight * hours);
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function formatTime(s) {
    const m = Math.floor(s/60); const h = Math.floor(m/60);
    return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

function updateTimer() { if(isPaused) return; elapsedSeconds++; document.getElementById('time-display').textContent = formatTime(elapsedSeconds); }

// --- ИСТОРИЯ ---
function updateHistoryUI() {
    const list = document.getElementById('history-list'); list.innerHTML = '';
    if(routeHistory.length === 0) { list.innerHTML = '<p style="opacity:0.5;text-align:center;">Маршрутов пока нет</p>'; return; }
    [...routeHistory].reverse().forEach((r) => {
        const div = document.createElement('div'); div.className = 'history-item'; div.style.borderLeftColor = r.color;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;"><span>${r.date}</span><span>${r.distance.toFixed(1)} км</span></div>
            <div style="font-size:12px;opacity:0.7;">${formatTime(r.time)} | ${r.avgSpeed.toFixed(1)} км/ч | ${r.calories} ккал</div>
            <div style="font-size:11px;">${r.weather||''}</div>
            <div style="margin-top:5px;display:flex;gap:5px;">
                <button onclick="exportGPX(${r.id})" style="background:transparent;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 8px;color:var(--text-color);">📤 GPX</button>
                <button onclick="viewRoute(${r.id})" style="background:transparent;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 8px;color:var(--text-color);">👁️</button>
                <button onclick="deleteRoute(${r.id})" style="background:transparent;border:1px solid #ef4444;border-radius:8px;padding:4px 8px;color:#ef4444;">🗑️</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function viewRoute(id) {
    const r = routeHistory.find(x=>x.id===id); if(!r) return; closeStats();
    points = r.points; userSettings.color = r.color;
    if (r.layer) toggleMapLayer(r.layer);
    drawRoute(); document.getElementById('distance-display').textContent = r.distance.toFixed(2);
    showToast('Маршрут загружен');
}

function deleteRoute(id) { if(confirm('Удалить этот маршрут?')) { routeHistory = routeHistory.filter(r => r.id !== id); localStorage.setItem('bike_routes', JSON.stringify(routeHistory)); updateHistoryUI(); showToast('Маршрут удален'); } }
function deleteSingleRoute() { closeSettingsTab(); openStatsFromSidebar(); }
function clearAllRoutes() { if(confirm('Очистить всю историю?')) { routeHistory = []; localStorage.setItem('bike_routes', JSON.stringify(routeHistory)); updateHistoryUI(); showToast('История очищена'); } }

// --- ЭКСПОРТ GPX ---
function exportAllGPX() {
    if (routeHistory.length === 0) return showToast('Нет маршрутов для экспорта');
    let gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="BikeTracker">\n`;
    let gpxFooter = `\n</gpx>`;
    let allTracks = '';
    routeHistory.forEach(r => {
        allTracks += `  <trk>\n    <name>${r.date}</name>\n    <trkseg>\n`;
        r.points.forEach(p => { allTracks += `      <trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.alt||0}</ele></trkpt>\n`; });
        allTracks += `    </trkseg>\n  </trk>\n`;
    });
    const fullGpx = gpxHeader + allTracks + gpxFooter;
    const blob = new Blob([fullGpx], {type:'application/gpx+xml'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `all_routes_${Date.now()}.gpx`; a.click();
    showToast(`Скачано ${routeHistory.length} маршрутов в одном файле .gpx`);
}

function importGPX() { document.getElementById('gpx-import-input').click(); }
function exportGPX(id) {
    const r = routeHistory.find(x=>x.id===id); if(!r) return;
    let gpx = `<?xml version="1.0"?><gpx><trk><name>${r.date}</name><trkseg>`;
    r.points.forEach(p => { gpx += `<trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.alt||0}</ele></trkpt>`; });
    gpx += `</trkseg></trk></gpx>`;
    const blob = new Blob([gpx], {type:'application/gpx+xml'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `route_${r.id}.gpx`; a.click();
}

// --- СТАТИСТИКА ---
function openStatsFromSidebar() {
    toggleSidebar();
    document.getElementById('stats-sidebar').classList.remove('hidden');
    document.getElementById('stats-content').style.display = 'block';
    const stats = document.getElementById('stats-summary');
    const totalKm = routeHistory.reduce((sum, r) => sum + r.distance, 0);
    const totalCal = routeHistory.reduce((sum, r) => sum + r.calories, 0);
    const avgSpeedAll = routeHistory.length>0 ? (routeHistory.reduce((s,r)=>s+r.avgSpeed,0)/routeHistory.length) : 0;
    const lastRide = routeHistory.length>0 ? routeHistory[routeHistory.length-1] : null;
    stats.innerHTML = `
        <div class="stat"><span>${totalKm.toFixed(0)}</span>${t('km')} всего</div>
        <div class="stat"><span>${routeHistory.length}</span>Поездок</div>
        <div class="stat"><span>${totalCal}</span>Ккал</div>
        <div class="stat"><span>${avgSpeedAll.toFixed(1)}</span>Ср. скорость</div>
        <div class="stat"><span>${lastRide ? lastRide.distance.toFixed(1) : 0}</span>Последний</div>
    `;
    updateHistoryUI();
}
function closeStats() { document.getElementById('stats-sidebar').classList.add('hidden'); }

// --- УТИЛИТЫ ---
function showToast(msg) {
    const toast = document.getElementById('toast'); toast.textContent = msg;
    toast.classList.remove('hidden'); clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
}
function closeModal() { document.getElementById('finish-modal').classList.add('hidden'); }
function shareScreenshot() {
    html2canvas(document.getElementById('map')).then(canvas => {
        const a = document.createElement('a'); a.download = 'my_ride.png'; a.href = canvas.toDataURL('image/png'); a.click();
    });
}
function resetApp() { if(confirm('Сбросить все настройки и данные?')) { localStorage.clear(); location.reload(); } }

// --- ИНТЕГРАЦИИ И SOS ---
function shareCurrentRoute() {
    if (points.length < 2) return showToast('Сначала запиши или нарисуй маршрут');
    const text = `Мой маршрут: ${totalDistance.toFixed(1)} км за ${formatTime(elapsedSeconds)}!`;
    if (navigator.share) {
        navigator.share({ title: 'Мой вело-маршрут', text: text }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text + ' (Скопируй координаты маршрута)');
        showToast('Текст скопирован в буфер!');
    }
}

function exportKML() {
    if (points.length < 2) return showToast('Сначала запиши или нарисуй маршрут');
    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n<Placemark>\n<LineString>\n<coordinates>\n`;
    points.forEach(p => { kml += `${p.lng},${p.lat},${p.alt||0}\n`; });
    kml += `</coordinates>\n</LineString>\n</Placemark>\n</Document>\n</kml>`;
    const blob = new Blob([kml], {type:'application/vnd.google-earth.kml+xml'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `route_${Date.now()}.kml`; a.click();
    showToast('KML файл скачан!');
}

function exportBackup() {
    const data = { routes: routeHistory, settings: userSettings, odo: odoTotal };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup_${Date.now()}.json`; a.click();
    showToast('Бэкап сохранён!');
}

function importBackup(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.routes && Array.isArray(data.routes)) {
                routeHistory = data.routes;
                localStorage.setItem('bike_routes', JSON.stringify(routeHistory));
                if (data.odo) odoTotal = data.odo;
                if (data.settings) {
                    userSettings = data.settings;
                    localStorage.setItem('bike_settings', JSON.stringify(userSettings));
                }
                showToast('Бэкап успешно восстановлен!');
                location.reload();
            } else {
                showToast('Неверный формат файла');
            }
        } catch(err) { showToast('Ошибка чтения бэкапа'); }
    };
    reader.readAsText(file);
}

function triggerSOS() {
    const contact = userSettings.sosContact || '';
    const action = confirm(`Вызвать SOS?\n\nНажми "OK", чтобы позвонить по номеру ${contact || 'не указан'}\nНажми "Отмена", чтобы отправить координаты через мессенджер.`);
    if (action) {
        if (contact) {
            window.location.href = "tel:" + contact;
        } else {
            showToast('Сначала укажи номер контакта в настройках системы');
        }
    } else {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const url = `https://maps.google.com/maps?q=${lat},${lng}`;
                const msg = `Мои текущие координаты: ${url}`;
                if (navigator.share) {
                    navigator.share({ title: 'Мои координаты SOS', text: msg }).catch(() => {});
                } else {
                    navigator.clipboard.writeText(msg);
                    showToast('Координаты скопированы в буфер!');
                }
            }, () => showToast('Не удалось определить координаты'));
        } else {
            showToast('GPS недоступен');
        }
    }
}

// --- МУЛЬТИУДАЛЕНИЕ ---
let isMultiDeleteMode = false;
function toggleMultiDeleteMode() {
    isMultiDeleteMode = !isMultiDeleteMode;
    if(isMultiDeleteMode) {
        showToast('Выбери маршруты для удаления');
        const list = document.getElementById('history-list');
        list.querySelectorAll('.history-item').forEach(el => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'multi-delete-checkbox';
            checkbox.style.cssText = 'margin-right: 10px; transform: scale(1.4);';
            el.prepend(checkbox);
        });
        addDeleteSelectedButton();
    } else {
        document.querySelectorAll('.multi-delete-checkbox').forEach(el => el.remove());
        const btn = document.getElementById('delete-selected-btn');
        if(btn) btn.remove();
        updateHistoryUI();
    }
}
function addDeleteSelectedButton() {
    const list = document.getElementById('history-list');
    const btn = document.createElement('button');
    btn.id = 'delete-selected-btn';
    btn.textContent = '🗑️ Удалить выбранные';
    btn.className = 'save-btn red-text';
    btn.style.cssText = 'margin-top:10px; width:100%;';
    btn.onclick = deleteSelectedRoutes;
    const parent = list.parentElement;
    parent.insertBefore(btn, list.nextSibling);
}
function deleteSelectedRoutes() {
    if(!isMultiDeleteMode) return;
    const selectedIds = [];
    document.querySelectorAll('.multi-delete-checkbox:checked').forEach(cb => {
        const item = cb.closest('.history-item');
        const buttons = item.querySelectorAll('button');
        const viewBtn = Array.from(buttons).find(b => b.textContent.includes('👁️'));
        if(viewBtn && viewBtn.onclick) {
            const match = viewBtn.onclick.toString().match(/viewRoute\((\d+)\)/);
            if(match) selectedIds.push(parseInt(match[1]));
        }
    });
    if(selectedIds.length === 0) { showToast('Не выбрано ни одного маршрута'); return; }
    if(confirm(`Удалить ${selectedIds.length} маршрут(ов)?`)) {
        routeHistory = routeHistory.filter(r => !selectedIds.includes(r.id));
        localStorage.setItem('bike_routes', JSON.stringify(routeHistory));
        showToast(`✅ Удалено ${selectedIds.length} маршрутов`);
        toggleMultiDeleteMode();
    }
}

// --- ДОСТИЖЕНИЯ (глобально) ---
function calculateAchievements(history) {
    const totalKm = history.reduce((sum, r) => sum + r.distance, 0);
    const totalRides = history.length;
    const maxSpeed = history.length > 0 ? Math.max(...history.map(r => r.maxSpeed || 0)) : 0;
    const totalCal = history.reduce((sum, r) => sum + r.calories, 0);
    const rideDays = new Set(history.map(r => new Date(r.date).toLocaleDateString()));
    const streak = rideDays.size;
    return [
        { id: 'first_ride', icon: '🚴', title: 'Первая поездка', unlocked: totalRides >= 1 },
        { id: 'first_10km', icon: '📏', title: 'Первые 10 км', unlocked: totalKm >= 10 },
        { id: 'first_50km', icon: '🏅', title: 'Первые 50 км', unlocked: totalKm >= 50 },
        { id: 'first_100km', icon: '🏆', title: 'Первые 100 км', unlocked: totalKm >= 100 },
        { id: 'speed_demon', icon: '💨', title: 'Скорость 30+ км/ч', unlocked: maxSpeed >= 30 },
        { id: 'streak_3', icon: '🔥', title: '3 дня катания', unlocked: streak >= 3 },
        { id: 'cal_burner', icon: '🍔', title: 'Сжёг 1000 ккал', unlocked: totalCal >= 1000 },
    ];
}

// --- ИНИЦИАЛИЗАЦИЯ ---
window.onload = function() {
    applySettings();
    const odoEl = document.getElementById('odo-display');
    if(odoEl) odoEl.textContent = odoTotal.toFixed(0);
    updateProgressBar();
};

// ============================================================
//  МАРШРУТИЗАЦИЯ (OSRM) И POI
// ============================================================

let isRoutingMode = false;
let routingPoints = [];
let routingSegments = [];
let routingPlacemarks = [];

function openRouting() {
    isRoutingMode = !isRoutingMode;
    if(isRoutingMode) {
        routingPoints = [];
        document.getElementById('routing-panel').style.display = 'flex';
        document.getElementById('bottom-controls').style.display = 'none';
        showToast('Режим маршрутизации: кликай по карте, чтобы добавить точки. Нажми "Построить маршрут" для OSRM.');
    } else {
        closeRouting();
    }
}

function closeRouting() {
    isRoutingMode = false;
    document.getElementById('routing-panel').style.display = 'none';
    document.getElementById('bottom-controls').style.display = 'flex';
    routingSegments.forEach(seg => map.geoObjects.remove(seg));
    routingSegments = [];
    routingPlacemarks.forEach(pm => map.geoObjects.remove(pm));
    routingPlacemarks = [];
    routingPoints = [];
    showToast('Режим маршрутизации закрыт');
}

function clearRouting() {
    routingSegments.forEach(seg => map.geoObjects.remove(seg));
    routingSegments = [];
    routingPlacemarks.forEach(pm => map.geoObjects.remove(pm));
    routingPlacemarks = [];
    routingPoints = [];
    document.getElementById('routing-points-count').textContent = 'Точек: 0';
    document.getElementById('routing-distance').textContent = 'Дистанция: -- км';
    document.getElementById('routing-time').textContent = 'Время: -- мин';
    showToast('Маршрут очищен');
}

function addRoutingPoint(lat, lng) {
    routingPoints.push({lat, lng});
    const placemark = new ymaps.Placemark([lat, lng], {
        iconContent: String(routingPoints.length)
    }, {
        preset: 'islands#blueStretchyIcon'
    });
    map.geoObjects.add(placemark);
    routingPlacemarks.push(placemark);
    document.getElementById('routing-points-count').textContent = `Точек: ${routingPoints.length}`;
}

function buildRouteFromRouting() {
    if(routingPoints.length < 2) { showToast('Добавь минимум 2 точки'); return; }
    const coordsStr = routingPoints.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/bicycle/${coordsStr}?overview=full&alternatives=true&geometries=geojson`;
    showToast('Ищем маршрут...');
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if(!data.routes || data.routes.length === 0) {
                showToast('Маршрут не найден');
                return;
            }
            routingSegments.forEach(seg => map.geoObjects.remove(seg));
            routingSegments = [];
            const colors = ['#00cc99', '#3b82f6', '#f59e0b'];
            data.routes.slice(0, 3).forEach((route, idx) => {
                const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                const poly = new ymaps.Polyline(coords, {
                    strokeColor: colors[idx % colors.length],
                    strokeWidth: 4,
                    strokeOpacity: 0.8
                });
                map.geoObjects.add(poly);
                routingSegments.push(poly);
                const dist = (route.distance / 1000).toFixed(1);
                const dur = Math.round(route.duration / 60);
                if(idx === 0) {
                    document.getElementById('routing-distance').textContent = `Дистанция: ${dist} км`;
                    document.getElementById('routing-time').textContent = `Время: ${dur} мин`;
                }
            });
            if(data.routes.length > 0) {
                const bounds = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                map.setBounds(bounds, {checkZoomRange: true, duration: 500});
            }
            showToast(`Найдено ${data.routes.length} маршрута(ов)`);
        })
        .catch(err => showToast('Ошибка OSRM: ' + err.message));
}

function saveRoutingRoute() {
    if(routingPoints.length < 2) { showToast('Нет маршрута для сохранения'); return; }
    const route = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        points: routingPoints,
        distance: 0,
        time: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        calories: 0,
        color: userSettings.color,
        weather: 'Спланированный маршрут',
        layer: userSettings.layer
    };
    routeHistory.push(route);
    localStorage.setItem('bike_routes', JSON.stringify(routeHistory));
    updateHistoryUI();
    showToast('Маршрут сохранён!');
}

// --- POI (Точки интереса) ---
function loadPOIs() {
    const pois = JSON.parse(localStorage.getItem('bike_pois')) || [];
    pois.forEach(poi => {
        const placemark = new ymaps.Placemark([poi.lat, poi.lng], {
            iconContent: poi.name || '📍',
            balloonContent: poi.name || 'Точка'
        }, {
            preset: 'islands#redStretchyIcon'
        });
        map.geoObjects.add(placemark);
    });
}

function addPOI() {
    showToast('Кликни на карте, чтобы добавить точку (POI)');
    // Временно добавляем обработчик клика
    const clickHandler = function(e) {
        const coords = e.get('coords');
        const lat = coords[0], lng = coords[1];
        const name = prompt('Введите название точки:', 'Моя точка');
        if(name !== null) {
            const pois = JSON.parse(localStorage.getItem('bike_pois')) || [];
            pois.push({lat, lng, name: name.trim() || 'Без названия'});
            localStorage.setItem('bike_pois', JSON.stringify(pois));
            // Перезагружаем POI на карте
            map.geoObjects.each(obj => {
                if(obj && obj.properties && obj.properties.get('iconContent') === '📍') {
                    map.geoObjects.remove(obj);
                }
            });
            loadPOIs();
            showToast('Точка добавлена!');
        }
        map.events.remove('click', clickHandler);
    };
    map.events.add('click', clickHandler);
}

function deletePOI(index) {
    if(!confirm('Удалить эту точку?')) return;
    const pois = JSON.parse(localStorage.getItem('bike_pois')) || [];
    pois.splice(index, 1);
    localStorage.setItem('bike_pois', JSON.stringify(pois));
    // Перезагружаем POI на карте
    map.geoObjects.each(obj => {
        if(obj && obj.properties && obj.properties.get('iconContent') === '📍') {
            map.geoObjects.remove(obj);
        }
    });
    loadPOIs();
    showToast('Точка удалена');
    // Обновляем вкладку POI в настройках
    document.getElementById('settings-tab-content').innerHTML = getTabHTML('poi');
}

function buildRouteToPOI(index) {
    const pois = JSON.parse(localStorage.getItem('bike_pois')) || [];
    if(index >= pois.length) { showToast('Точка не найдена'); return; }
    const poi = pois[index];
    // Определяем текущее положение как старт (если есть GPS)
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const startLat = pos.coords.latitude;
            const startLng = pos.coords.longitude;
            routingPoints = [{lat: startLat, lng: startLng}, {lat: poi.lat, lng: poi.lng}];
            openRouting();
            // Добавляем точки на карту
            routingPoints.forEach(p => addRoutingPoint(p.lat, p.lng));
            // Строим маршрут
            buildRouteFromRouting();
        }, () => {
            showToast('Не удалось определить местоположение');
        });
    } else {
        showToast('GPS недоступен');
    }
}

// --- TELEGRAM-ИНТЕГРАЦИЯ (Web App и отправка) ---
function shareToTelegram() {
    if(!window.Telegram?.WebApp) {
        showToast('Это приложение не внутри Telegram');
        return;
    }
    if(points.length < 2) {
        showToast('Сначала запиши или нарисуй маршрут');
        return;
    }
    const text = `Мой маршрут: ${totalDistance.toFixed(1)} км за ${formatTime(elapsedSeconds)}!`;
    try {
        window.Telegram.WebApp.sendData(JSON.stringify({
            type: 'route',
            distance: totalDistance,
            time: elapsedSeconds,
            points: points
        }));
        showToast('Отправлено в Telegram!');
    } catch(e) {
        showToast('Ошибка отправки: ' + e.message);
    }
}

// --- ОБРАБОТЧИК TELEGRAM WEB APP (если запущено внутри бота) ---
if(window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    // Показываем кнопку отправки
    const shareBtn = document.getElementById('telegram-share');
    if(shareBtn) shareBtn.style.display = 'block';
    // Можно также отправлять данные при сохранении маршрута
}

// --- КОНЕЦ ФАЙЛА ---
