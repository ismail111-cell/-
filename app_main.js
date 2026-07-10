// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let map, routeLine;
let isRecording = false, isPaused = false, isManualMode = false, isSplash = true;
let points = [], timerInterval, elapsedSeconds = 0;
let totalDistance = 0, currentSpeed = 0, maxSpeed = 0;
let watchId = null, startTime, isAppActive = false;
let routeHistory = JSON.parse(localStorage.getItem('bike_routes')) || [];
let userSettings = JSON.parse(localStorage.getItem('bike_settings')) || {
    name: 'Гонщик', weight: 70, height: 175, age: 30, bike: 'hybrid',
    theme: 'dark', lang: 'ru', color: '#00ffcc', lineWidth: 4,
    voice: true, voiceFreq: '5', startSound: true, vibration: true,
    dailyGoal: 0, autoPause: true, tempUnit: 'C', streetView: true
};
let odoTotal = 0, currentRouteId = null;
const MOTIVATION = {
    ru: [
        "Ты просто машина! Крути дальше!",
        "5 км позади, пульс в норме, продолжай!",
        "Рекордный темп! Сегодня ветер твой друг.",
        "Отличный ритм, не сбавляй обороты!",
        "Ещё немного и ты покоришь новую вершину!",
        "Красота! Ты создан для велосипеда.",
        "10 километров! Цель близка, жми!",
        "Ого, да ты летишь! Фантастика!"
    ],
    en: [
        "You're a machine! Keep going!",
        "5km down, heart rate normal, push on!",
        "Record pace! The wind is your friend today.",
        "Great rhythm, don't slow down!",
        "A little more and you'll conquer a new peak!",
        "Beautiful! You were born for this.",
        "10km! The goal is near, pedal hard!",
        "Whoa, you're flying! Fantastic!"
    ],
    ar: [
        "أنت آلة! استمر!",
        "5 كم خلفك، نبضك طبيعي، تابع!",
        "سرعة قياسية! الرياح صديقتك اليوم.",
        "إيقاع رائع، لا تبطئ!",
        "القليل وسنغزو قمة جديدة!",
        "جميل! لقد خلقت للدراجات.",
        "10 كم! الهدف قريب، دوّس بقوة!",
        "واو، أنت تطير! رائع!"
    ]
};

// --- ЗАГРУЗКА КАРТЫ ---
ymaps.ready(function() {
    map = new ymaps.Map('map', { center: [55.7961, 49.1064], zoom: 13, controls: ['zoomControl'] });
    map.controls.add('geolocationControl', { float: 'left' });
});

// --- ВХОД В ПРИЛОЖЕНИЕ И СТАРТОВЫЙ ЭКРАН ---
function enterApp() {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    isSplash = false; applySettings(); updateHistoryUI();
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
    applySettings(); updateHistoryUI();
    setTimeout(() => { if (map && map.container) { try { map.container.fitToViewport(); } catch(e) {} } openStatsFromSidebar(); }, 400);
}
function openSettingsFromSplash() {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block'; isSplash = false;
    applySettings(); updateHistoryUI();
    setTimeout(() => { if (map && map.container) { try { map.container.fitToViewport(); } catch(e) {} } openSettings(); }, 400);
}
// --- НАВИГАЦИЯ И НАСТРОЙКИ ---
function toggleSidebar() { document.getElementById('main-sidebar').classList.toggle('hidden'); }
function openSettings() { toggleSidebar(); document.getElementById('settings-sidebar').classList.remove('hidden'); document.getElementById('settings-menu-list').style.display = 'flex'; document.getElementById('settings-tab-content').style.display = 'none'; }
function closeSettings() { document.getElementById('settings-sidebar').classList.add('hidden'); }
function openSettingsTab(tab) {
    document.getElementById('settings-menu-list').style.display = 'none';
    const content = document.getElementById('settings-tab-content');
    content.style.display = 'flex'; content.innerHTML = getTabHTML(tab);
}
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
        html += `<h4>Управление историей</h4><button class="save-btn" onclick="deleteSingleRoute()">🗑️ Удалить один маршрут</button><button class="save-btn" onclick="deleteMultipleRoutes()">📦 Удалить несколько</button><button class="save-btn red-text" onclick="clearAllRoutes()">⚠️ Очистить всё</button><button class="save-btn" onclick="exportAllGPX()">📤 Экспорт всех GPX (ZIP)</button><button class="save-btn" onclick="importGPX()">📥 Импорт GPX</button>`;
    } else if(tab === 'system') {
        html += `<h4>Система</h4><label>Экстренная кнопка (SOS)</label><select id="s-sos"><option value="true" ${s.sos?'selected':''}>Вкл</option><option value="false" ${!s.sos?'selected':''}>Выкл</option></select><label>Контакт для SOS</label><input type="text" id="s-soscontact" value="${s.sosContact||''}"><button class="save-btn" onclick="saveSettingsTab('system')">💾 Сохранить</button><button class="save-btn red-text" onclick="resetApp()">⚠️ Сброс до заводских</button>`;
    } else { html += `<p>Настройки для этой вкладки в разработке</p>`; }
    return html;
}
function closeSettingsTab() { document.getElementById('settings-menu-list').style.display = 'flex'; document.getElementById('settings-tab-content').style.display = 'none'; }
function saveSettingsTab(tab) {
    const s = userSettings;
    if(tab === 'profile') { s.name = document.getElementById('s-name').value; s.weight = parseFloat(document.getElementById('s-weight').value) || 70; s.height = parseFloat(document.getElementById('s-height').value) || 175; s.age = parseInt(document.getElementById('s-age').value) || 30; s.bike = document.getElementById('s-bike').value; }
    else if(tab === 'map') { s.layer = document.getElementById('s-layer').value; s.color = document.getElementById('s-color').value; s.lineWidth = parseInt(document.getElementById('s-width').value); s.compass = document.getElementById('s-compass').value === 'true'; toggleMapLayer(s.layer); }
    else if(tab === 'sound') { s.voice = document.getElementById('s-voice').value === 'true'; s.voiceFreq = document.getElementById('s-voicefreq').value; s.startSound = document.getElementById('s-startsound').value === 'true'; s.vibration = document.getElementById('s-vibration').value === 'true'; }
    else if(tab === 'weather') { s.autoWeather = document.getElementById('s-autoweather').value === 'true'; s.forecast = document.getElementById('s-forecast').value === 'true'; s.streetView = document.getElementById('s-streetview').value === 'true'; }
    else if(tab === 'system') { s.sos = document.getElementById('s-sos').value === 'true'; s.sosContact = document.getElementById('s-soscontact').value; }
    localStorage.setItem('bike_settings', JSON.stringify(s)); applySettings(); showToast('Настройки сохранены!'); closeSettingsTab();
}
function toggleMapLayer(layer) { if(!map) return; map.setType(layer === 'satellite' ? 'yandex#satellite' : 'yandex#map'); }

// --- ПРИМЕНЕНИЕ НАСТРОЕК И ТЕМ ---
function applySettings() {
    const s = userSettings; currentLang = s.lang;
    document.body.classList.toggle('light-theme', s.theme === 'light');
    const colorEl = document.getElementById('route-color');
    if(colorEl) colorEl.value = s.color;
    applyLanguage();
}
function applyLanguage() { document.querySelectorAll('[data-lang]').forEach(el => { const key = el.dataset.lang; el.textContent = t(key); }); }

// --- ЗАПИСЬ GPS ---
function startRecording() {
    if(isRecording) return; if(!navigator.geolocation) { showToast('GPS недоступен'); return; }
    isRecording = true; isPaused = false; isManualMode = false;
    points = []; totalDistance = 0; elapsedSeconds = 0; maxSpeed = 0;
    document.getElementById('btn-start').style.display = 'none'; document.getElementById('btn-pause').style.display = 'flex'; document.getElementById('btn-stop').style.display = 'flex'; document.getElementById('btn-save').style.display = 'none';
    if(userSettings.startSound) playBeep(); if(userSettings.vibration) navigator.vibrate(100); if(userSettings.autoWeather) updateWeather();
    startTime = Date.now(); timerInterval = setInterval(updateTimer, 1000);
    watchId = navigator.geolocation.watchPosition(
    (pos) => {
        if (isPaused) return;
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        currentSpeed = pos.coords.speed * 3.6 || 0;
        if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;
        document.getElementById('speed-display').textContent = currentSpeed.toFixed(1);
        if (points.length > 0) {
            const last = points[points.length - 1];
            const d = haversine(last.lat, last.lng, lat, lng);
            totalDistance += d;
            document.getElementById('distance-display').textContent = totalDistance.toFixed(2);
            if (userSettings.autoPause && currentSpeed < 0.5 && elapsedSeconds > 10 && !isPaused) togglePause(true);
            else if (userSettings.autoPause && currentSpeed > 2 && isPaused) togglePause(false);
        }
        points.push({lat, lng, alt: pos.coords.altitude || 0});
        drawRoute();
        if (userSettings.streetView) geocodeStreet(lat, lng);
        checkMotivation();
    },
    (err) => console.warn(err),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
);
function drawRoute() {
    if(routeLine) map.geoObjects.remove(routeLine); if(points.length < 2) return;
    const coords = points.map(p => [p.lat, p.lng]);
    routeLine = new ymaps.Polyline(coords, { strokeColor: userSettings.color, strokeWidth: userSettings.lineWidth || 4, strokeOpacity: 0.9 });
    map.geoObjects.add(routeLine);
}
// --- МОТИВАЦИЯ И ГОЛОС ---
let lastMotivationKm = 0;
function checkMotivation() {
    if (!userSettings.voice) return;
    const freq = parseInt(userSettings.voiceFreq) || 5;
    // Проверяем, что прошло не менее freq километров от последнего объявления
    if (totalDistance - lastMotivationKm >= freq) {
        lastMotivationKm = totalDistance;
        const arr = MOTIVATION[currentLang] || MOTIVATION['ru'];
        // Заменяем фиксированную фразу на динамическую с реальным расстоянием
        const phrase = `Проехал ${totalDistance.toFixed(0)} километров!`;
        speakText(phrase);
    }
}

function speakText(text) {
    if (!userSettings.voice) return;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLang === 'ru' ? 'ru-RU' : 'en-US';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }
}
function playBeep() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 800; gain.gain.value = 0.3; osc.start(); setTimeout(() => { osc.stop(); }, 150); } catch(e) {} }

// --- РУЧНОЕ РИСОВАНИЕ ---
function enableManualDraw() {
    if (isRecording) return;
    isManualMode = !isManualMode;
    if (isManualMode) {
        points = [];
        document.getElementById('btn-manual').style.background = '#ffb700';
        document.getElementById('btn-undo').style.display = 'flex';
        document.getElementById('btn-clear').style.display = 'flex';
        // Добавляем обработчик только если режим включён
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
            speakText('Маршрут нарисован');
        }
    }
}
function undoLastPoint() { if(points.length > 0) { points.pop(); drawRoute(); showToast('Точка удалена'); } }
function clearManualRoute() { if(points.length > 0) { points = []; drawRoute(); showToast('Маршрут очищен'); document.getElementById('btn-save').style.display = 'none'; } }

// --- ПАУЗА И СТОП ---
function togglePause(force) { if(!isRecording) return; isPaused = force !== null ? force : !isPaused; document.getElementById('btn-pause').textContent = isPaused ? '▶️' : '⏸'; if(isPaused) speakText('Пауза'); else speakText('Продолжаем'); }
function stopRecording() {
    if(isRecording) { navigator.geolocation.clearWatch(watchId); clearInterval(timerInterval); isRecording = false; document.getElementById('btn-start').style.display = 'flex'; document.getElementById('btn-pause').style.display = 'none'; document.getElementById('btn-stop').style.display = 'none'; document.getElementById('btn-save').style.display = 'flex'; speakText('Поездка завершена'); showSummary(); }
}

// --- СОХРАНЕНИЕ ---
function saveRoute() {
    if(points.length < 2) return showToast('Нет точек для сохранения');
    const cal = calcCalories(totalDistance, elapsedSeconds);
    const route = { id: Date.now(), date: new Date().toLocaleString(), points: points, distance: totalDistance, time: elapsedSeconds, avgSpeed: elapsedSeconds>0?(totalDistance/(elapsedSeconds/3600)):0, maxSpeed: maxSpeed, calories: cal, color: userSettings.color, weather: document.getElementById('weather-temp').textContent + ' ' + document.getElementById('weather-icon').textContent };
    routeHistory.push(route); localStorage.setItem('bike_routes', JSON.stringify(routeHistory));
    document.getElementById('btn-save').style.display = 'none'; updateHistoryUI(); showToast('✅ Маршрут сохранен!'); speakText('Маршрут сохранен');
}
// --- ИТОГИ ---
function showSummary() {
    const modal = document.getElementById('finish-modal'); const div = document.getElementById('summary-data');
    const avg = elapsedSeconds>0?(totalDistance/(elapsedSeconds/3600)):0; const cal = calcCalories(totalDistance, elapsedSeconds);
    div.innerHTML = `<p><b>${t('distance')}:</b> ${totalDistance.toFixed(2)} ${t('km')}</p><p><b>${t('time')}:</b> ${formatTime(elapsedSeconds)}</p><p><b>${t('speed')}:</b> ${avg.toFixed(1)} ${t('km')}/ч</p><p><b>Макс. скорость:</b> ${maxSpeed.toFixed(1)} ${t('km')}/ч</p><p><b>${t('cal')}:</b> ${cal} ${t('cal')}</p><p><b>Погода:</b> ${document.getElementById('weather-temp').textContent}</p>`;
    setTimeout(() => drawHeightChart({points}), 100); modal.classList.remove('hidden');
}
function drawHeightChart(route) {
    const canvas = document.getElementById('height-chart'); const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth; canvas.height = 100; ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!route.points || route.points.length<2) return;
    const heights = route.points.map(p => p.alt || 0); const minH = Math.min(...heights), maxH = Math.max(...heights), range = maxH-minH || 1;
    ctx.beginPath(); ctx.strokeStyle = userSettings.color; ctx.lineWidth = 2;
    heights.forEach((h, i) => { const x = (i/(heights.length-1))*canvas.width; const y = canvas.height - ((h-minH)/range)*canvas.height; i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); }); ctx.stroke();
}

// --- ПОГОДА ---
function updateWeather() {
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const {latitude, longitude} = pos.coords;
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=YOUR_OPENWEATHER_KEY`;
        try { const resp = await fetch(url); const data = await resp.json(); document.getElementById('weather-temp').textContent = Math.round(data.main.temp) + '°C'; document.getElementById('weather-icon').textContent = data.weather[0].icon.includes('n') ? '🌙' : data.weather[0].icon.includes('01') ? '☀️' : '☁️'; } catch(e) { document.getElementById('weather-temp').textContent = '22°C'; }
    });
}
function geocodeStreet(lat, lng) {
    ymaps.geocode([lat, lng]).then(res => { const first = res.geoObjects.get(0); if(first) { const name = first.getThoroughfare() || first.getAddressLine(); document.getElementById('street-name').textContent = name || 'Казань'; } });
}

// --- МАТЕМАТИКА ---
function calcCalories(km, seconds) { const weight = userSettings.weight || 70; const hours = seconds / 3600; const speed = hours > 0 ? km / hours : 0; let met = 4.0; if(speed > 20) met = 8.0; else if(speed > 15) met = 6.0; else if(speed > 10) met = 4.0; else met = 3.0; return Math.round(met * weight * hours); }
function haversine(lat1, lon1, lat2, lon2) { const R = 6371; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180; const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return 2 * R * Math.asin(Math.sqrt(a)); }
function formatTime(s) { const m = Math.floor(s/60); const h = Math.floor(m/60); return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
function updateTimer() { if(isPaused) return; elapsedSeconds++; document.getElementById('time-display').textContent = formatTime(elapsedSeconds); }

// --- ИСТОРИЯ ---
function updateHistoryUI() {
    const list = document.getElementById('history-list'); list.innerHTML = '';
    if(routeHistory.length === 0) { list.innerHTML = '<p style="opacity:0.5;text-align:center;">Маршрутов пока нет</p>'; return; }
    [...routeHistory].reverse().forEach((r) => {
        const div = document.createElement('div'); div.className = 'history-item'; div.style.borderLeftColor = r.color;
        div.innerHTML = `<div style="display:flex;justify-content:space-between;"><span>${r.date}</span><span>${r.distance.toFixed(1)} км</span></div><div style="font-size:12px;opacity:0.7;">${formatTime(r.time)} | ${r.avgSpeed.toFixed(1)} км/ч | ${r.calories} ккал</div><div style="font-size:11px;">${r.weather||''}</div><div style="margin-top:5px;display:flex;gap:5px;"><button onclick="exportGPX(${r.id})" style="background:transparent;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 8px;color:var(--text-color);">📤 GPX</button><button onclick="viewRoute(${r.id})" style="background:transparent;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 8px;color:var(--text-color);">👁️</button><button onclick="deleteRoute(${r.id})" style="background:transparent;border:1px solid #ef4444;border-radius:8px;padding:4px 8px;color:#ef4444;">🗑️</button></div>`;
        list.appendChild(div);
    });
}
function viewRoute(id) {
    const r = routeHistory.find(x => x.id === id);
    if (!r) return;
    closeStats();
    points = r.points;
    // Принудительно устанавливаем цвет линии из сохранённого маршрута
    userSettings.color = r.color;
    drawRoute();
    document.getElementById('distance-display').textContent = r.distance.toFixed(2);
    showToast('Маршрут загружен');
}
function deleteRoute(id) { if(confirm('Удалить этот маршрут?')) { routeHistory = routeHistory.filter(r => r.id !== id); localStorage.setItem('bike_routes', JSON.stringify(routeHistory)); updateHistoryUI(); showToast('Маршрут удален'); } }
function deleteSingleRoute() { closeSettingsTab(); openStatsFromSidebar(); }
function deleteMultipleRoutes() { showToast('Выбор нескольких маршрутов будет в следующем обновлении!'); }
function clearAllRoutes() { if(confirm('Очистить всю историю?')) { routeHistory = []; localStorage.setItem('bike_routes', JSON.stringify(routeHistory)); updateHistoryUI(); showToast('История очищена'); } }
function exportAllGPX() { showToast('Экспорт всех GPX появится в следующей версии!'); }
function importGPX() { showToast('Импорт GPX появится в следующей версии!'); }
function exportGPX(id) { const r = routeHistory.find(x=>x.id===id); if(!r) return; let gpx = `<?xml version="1.0"?><gpx><trk><name>${r.date}</name><trkseg>`; r.points.forEach(p => { gpx += `<trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.alt||0}</ele></trkpt>`; }); gpx += `</trkseg></trk></gpx>`; const blob = new Blob([gpx], {type:'application/gpx+xml'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `route_${r.id}.gpx`; a.click(); }

// --- СТАТИСТИКА ---
function openStatsFromSidebar() { toggleSidebar(); document.getElementById('stats-sidebar').classList.remove('hidden'); document.getElementById('stats-content').style.display = 'block'; const stats = document.getElementById('stats-summary'); const totalKm = routeHistory.reduce((sum, r) => sum + r.distance, 0); const totalCal = routeHistory.reduce((sum, r) => sum + r.calories, 0); const avgSpeedAll = routeHistory.length>0 ? (routeHistory.reduce((s,r)=>s+r.avgSpeed,0)/routeHistory.length) : 0; const lastRide = routeHistory.length>0 ? routeHistory[routeHistory.length-1] : null; stats.innerHTML = `<div class="stat"><span>${totalKm.toFixed(0)}</span>${t('km')} всего</div><div class="stat"><span>${routeHistory.length}</span>Поездок</div><div class="stat"><span>${totalCal}</span>Ккал</div><div class="stat"><span>${avgSpeedAll.toFixed(1)}</span>Ср. скорость</div><div class="stat"><span>${lastRide ? lastRide.distance.toFixed(1) : 0}</span>Последний</div>`; updateHistoryUI(); }
function closeStats() { document.getElementById('stats-sidebar').classList.add('hidden'); }

// --- УТИЛИТЫ ---
function showToast(msg) { const toast = document.getElementById('toast'); toast.textContent = msg; toast.classList.remove('hidden'); clearTimeout(toast._timeout); toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500); }
function closeModal() { document.getElementById('finish-modal').classList.add('hidden'); }
function shareScreenshot() { html2canvas(document.getElementById('map')).then(canvas => { const a = document.createElement('a'); a.download = 'my_ride.png'; a.href = canvas.toDataURL('image/png'); a.click(); }); }
function resetApp() { if(confirm('Сбросить все настройки и данные?')) { localStorage.clear(); location.reload(); } }

// --- ИНИЦИАЛИЗАЦИЯ ---
window.onload = function() {
    applySettings();
    const odoEl = document.getElementById('odo-display');
    if(odoEl) odoEl.textContent = odoTotal.toFixed(0);
};
