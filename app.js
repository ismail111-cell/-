// --- Инициализация и переменные ---
let map, myPlacemark, routeLine;
let isRecording = false, isPaused = false, isManualMode = false;
let points = [], timeStart, timerInterval, elapsedSeconds = 0;
let totalDistance = 0, currentSpeed = 0;
let watchId = null;
let routeHistory = JSON.parse(localStorage.getItem('bike_routes')) || [];
let odoTotal = JSON.parse(localStorage.getItem('bike_odo')) || 0;
let userSettings = JSON.parse(localStorage.getItem('bike_settings')) || {
    name: 'Велосипедист', weight: 70, height: 175, theme: 'dark', lang: 'ru', color: '#00ffcc'
};
let currentRoute = null; // Для ручного рисования

// --- Загрузка карты ---
ymaps.ready(function() {
    map = new ymaps.Map('map', {
        center: [55.7961, 49.1064], // Казань
        zoom: 13,
        controls: ['zoomControl', 'geolocationControl']
    });
    // Загрузка сохраненных маршрутов на карту
    loadHistoryOnMap();
});

// --- Запуск записи (GPS) ---
function startRecording() {
    if (isRecording) return;
    if (!navigator.geolocation) { alert('GPS недоступен'); return; }
    
    isRecording = true; isPaused = false; isManualMode = false;
    points = []; totalDistance = 0; elapsedSeconds = 0;
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-pause').style.display = 'inline-block';
    document.getElementById('btn-stop').style.display = 'inline-block';
    document.getElementById('btn-save').style.display = 'none';
    
    timeStart = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    
    // Следим за GPS
    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            if (isPaused) return;
            const lat = pos.coords.latitude, lng = pos.coords.longitude;
            currentSpeed = pos.coords.speed * 3.6 || 0; // м/с в км/ч
            document.getElementById('speed-display').textContent = currentSpeed.toFixed(1);
            
            if (points.length > 0) {
                const last = points[points.length - 1];
                const d = haversine(last.lat, last.lng, lat, lng);
                totalDistance += d;
                document.getElementById('distance-display').textContent = totalDistance.toFixed(2);
                // Авто-пауза (если скорость < 0.5 км/ч > 10 сек)
                if (currentSpeed < 0.5 && elapsedSeconds > 10) togglePause(true);
                else if (currentSpeed > 2 && isPaused) togglePause(false);
            }
            points.push({lat, lng, alt: pos.coords.altitude || 0});
            drawRoute();
        },
        (err) => console.warn('GPS ошибка', err),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
    speakText(t('start'));
}

// --- Рисование маршрута на карте ---
function drawRoute() {
    if (routeLine) map.geoObjects.remove(routeLine);
    if (points.length < 2) return;
    const coords = points.map(p => [p.lat, p.lng]);
    routeLine = new ymaps.Polyline(coords, {
        strokeColor: userSettings.color,
        strokeWidth: 4,
        strokeOpacity: 0.8
    });
    map.geoObjects.add(routeLine);
    map.setBounds(routeLine.geometry.getBounds(), {checkZoomRange: true, duration: 300});
}

// --- Ручной режим (рисование пальцем) ---
function enableManualDraw() {
    if (isRecording) return;
    isManualMode = !isManualMode;
    if (isManualMode) {
        points = [];
        document.getElementById('btn-manual').textContent = '✏️ Завершить';
        map.events.add('click', (e) => {
            const coords = e.get('coords');
            points.push({lat: coords[0], lng: coords[1], alt: 0});
            drawRoute();
        });
    } else {
        map.events.remove('click');
        document.getElementById('btn-manual').textContent = '✏️ Рисовать';
        if (points.length > 0) {
            // Считаем расстояние для ручного
            totalDistance = 0;
            for(let i=1; i<points.length; i++) {
                totalDistance += haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
            }
            document.getElementById('distance-display').textContent = totalDistance.toFixed(2);
            document.getElementById('btn-save').style.display = 'inline-block';
            speakText('Маршрут нарисован');
        }
    }
}

// --- Пауза ---
function togglePause(forceState = null) {
    if (!isRecording) return;
    isPaused = forceState !== null ? forceState : !isPaused;
    document.getElementById('btn-pause').textContent = isPaused ? '▶️ Продолжить' : '⏸ Пауза';
    if (isPaused) speakText('Пауза');
    else speakText('Продолжаем');
}

// --- Остановка и итоги ---
function stopRecording() {
    if (isRecording) {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(timerInterval);
        isRecording = false;
        document.getElementById('btn-start').style.display = 'inline-block';
        document.getElementById('btn-pause').style.display = 'none';
        document.getElementById('btn-stop').style.display = 'none';
        document.getElementById('btn-save').style.display = 'inline-block';
        speakText('Поездка завершена');
        showSummary();
    }
}

// --- Сохранение маршрута в историю ---
function saveRoute() {
    if (points.length < 2) return alert('Нет точек для сохранения');
    const route = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        points: points,
        distance: totalDistance,
        time: elapsedSeconds,
        avgSpeed: elapsedSeconds > 0 ? (totalDistance / (elapsedSeconds / 3600)) : 0,
        calories: calcCalories(totalDistance, elapsedSeconds),
        color: userSettings.color,
        weather: document.getElementById('weather-temp').textContent + ' ' + document.getElementById('weather-icon').textContent
    };
    routeHistory.push(route);
    odoTotal += totalDistance;
    localStorage.setItem('bike_routes', JSON.stringify(routeHistory));
    localStorage.setItem('bike_odo', JSON.stringify(odoTotal));
    document.getElementById('odo-display').textContent = odoTotal.toFixed(0);
    document.getElementById('btn-save').style.display = 'none';
    updateHistoryUI();
    loadHistoryOnMap();
    alert('Маршрут сохранен!');
    speakText('Сохранено');
}

// --- Расчет калорий (MET) ---
function calcCalories(km, seconds) {
    const weight = userSettings.weight || 70;
    const hours = seconds / 3600;
    const speed = hours > 0 ? km / hours : 0;
    let met = 4.0; // Велосипед 10-12 км/ч
    if (speed > 20) met = 8.0;
    else if (speed > 15) met = 6.0;
    else if (speed > 10) met = 4.0;
    else met = 3.0;
    return Math.round(met * weight * hours);
}

// --- Экспорт GPX ---
function exportGPX(route) {
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeTracker">
  <trk><name>${route.date}</name><trkseg>`;
    route.points.forEach(p => {
        gpx += `<trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.alt||0}</ele></trkpt>`;
    });
    gpx += `</trkseg></trk></gpx>`;
    const blob = new Blob([gpx], {type: 'application/gpx+xml'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `route_${route.id}.gpx`;
    link.click();
}

// --- График высоты (в модальном окне) ---
function drawHeightChart(route) {
    const canvas = document.getElementById('height-chart');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 100;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (!route.points || route.points.length < 2) return;
    const heights = route.points.map(p => p.alt || 0);
    const minH = Math.min(...heights), maxH = Math.max(...heights);
    const range = maxH - minH || 1;
    ctx.beginPath();
    ctx.strokeStyle = userSettings.color;
    ctx.lineWidth = 2;
    heights.forEach((h, i) => {
        const x = (i / (heights.length-1)) * canvas.width;
        const y = canvas.height - ((h - minH) / range) * canvas.height;
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
}

// --- Показать итоги (модалка) ---
function showSummary() {
    const modal = document.getElementById('finish-modal');
    const div = document.getElementById('summary-data');
    const avg = elapsedSeconds > 0 ? (totalDistance / (elapsedSeconds / 3600)) : 0;
    const cal = calcCalories(totalDistance, elapsedSeconds);
    div.innerHTML = `
        <p><b>${t('distance')}:</b> ${totalDistance.toFixed(2)} ${t('km')}</p>
        <p><b>${t('time')}:</b> ${formatTime(elapsedSeconds)}</p>
        <p><b>${t('speed')}:</b> ${avg.toFixed(1)} ${t('km')}/ч</p>
        <p><b>${t('cal')}:</b> ${cal} ${t('cal')}</p>
        <p><b>Погода:</b> ${document.getElementById('weather-temp').textContent}</p>
    `;
    // Рисуем график высоты
    setTimeout(() => drawHeightChart({points}), 100);
    modal.classList.remove('hidden');
}

// --- Скриншот и поделиться ---
function shareScreenshot() {
    html2canvas(document.getElementById('map')).then(canvas => {
        const link = document.createElement('a');
        link.download = 'my_ride.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

// --- Обновление UI истории ---
function updateHistoryUI() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    if(routeHistory.length === 0) { list.innerHTML = '<p style="opacity:0.5">Нет маршрутов</p>'; return; }
    // Показываем последние 50
    [...routeHistory].reverse().forEach((r, idx) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.style.cssText = 'margin-bottom:15px; background:var(--card-bg); padding:12px; border-radius:12px; cursor:pointer; border-left: 4px solid '+r.color;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span>${r.date}</span>
                <span>${r.distance.toFixed(1)} км</span>
            </div>
            <div style="font-size:12px; opacity:0.7;">${formatTime(r.time)} | ${r.avgSpeed.toFixed(1)} км/ч | ${r.calories} ккал</div>
            <div style="font-size:12px;">${r.weather || ''}</div>
            <div style="margin-top:5px; display:flex; gap:5px;">
                <button onclick="exportGPX(routeHistory.find(x=>x.id===${r.id}))">📤 GPX</button>
                <button onclick="viewRoute(${r.id})">👁️ Показать</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- Просмотр маршрута на карте ---
function viewRoute(id) {
    const route = routeHistory.find(r => r.id === id);
    if(!route) return;
    toggleSidebar('history');
    points = route.points;
    drawRoute();
    document.getElementById('distance-display').textContent = route.distance.toFixed(2);
}

// --- Загрузка всех маршрутов на карту (превью) ---
function loadHistoryOnMap() {
    // Здесь можно отрисовать все маршруты полупрозрачными линиями, если нужно.
    // Пока оставим только активный.
}

// --- Погода (по клику) ---
function updateWeather() {
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const {latitude, longitude} = pos.coords;
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=YOUR_OPENWEATHER_KEY`;
        // Вставь свой ключ OpenWeather (бесплатный) или используй заглушку
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            document.getElementById('weather-temp').textContent = Math.round(data.main.temp) + '°C';
            document.getElementById('weather-icon').textContent = data.weather[0].icon === '01d' ? '☀️' : '☁️';
        } catch(e) {
            document.getElementById('weather-temp').textContent = '22°C'; // Заглушка
        }
    });
}

// --- Таймер ---
function updateTimer() {
    if(isPaused) return;
    elapsedSeconds++;
    document.getElementById('time-display').textContent = formatTime(elapsedSeconds);
}

function formatTime(s) {
    const m = Math.floor(s/60); const h = Math.floor(m/60);
    return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

// --- Хаверсинус (расчет расстояния) ---
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// --- Голос (TTS) ---
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLang === 'ru' ? 'ru-RU' : 'en-US';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }
}

// --- Настройки ---
function saveSettings() {
    userSettings.name = document.getElementById('user-name').value;
    userSettings.weight = parseFloat(document.getElementById('user-weight').value) || 70;
    userSettings.height = parseFloat(document.getElementById('user-height').value) || 175;
    userSettings.theme = document.getElementById('theme-select').value;
    userSettings.lang = document.getElementById('lang-select').value;
    userSettings.color = document.getElementById('route-color').value;
    
    localStorage.setItem('bike_settings', JSON.stringify(userSettings));
    currentLang = userSettings.lang;
    applyTheme();
    applyLanguage();
    document.getElementById('odo-display').textContent = odoTotal.toFixed(0);
    // Перезагружаем карту с новым языком
    if(userSettings.lang !== 'ru' && userSettings.lang !== 'en' && userSettings.lang !== 'ar') userSettings.lang='ru';
    location.reload();
}

function applyTheme() {
    if(userSettings.theme === 'light') document.body.classList.add('light-theme');
    else document.body.classList.remove('light-theme');
}

function applyLanguage() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.dataset.lang;
        el.textContent = t(key);
    });
}

function toggleSidebar(type) {
    const el = document.getElementById(type + '-sidebar');
    el.classList.toggle('hidden');
}

function closeModal() {
    document.getElementById('finish-modal').classList.add('hidden');
}

// --- Инициализация при загрузке ---
window.onload = function() {
    // Загружаем настройки
    const s = userSettings;
    document.getElementById('user-name').value = s.name;
    document.getElementById('user-weight').value = s.weight;
    document.getElementById('user-height').value = s.height;
    document.getElementById('theme-select').value = s.theme;
    document.getElementById('lang-select').value = s.lang;
    document.getElementById('route-color').value = s.color;
    currentLang = s.lang;
    applyTheme();
    applyLanguage();
    document.getElementById('odo-display').textContent = odoTotal.toFixed(0);
    updateHistoryUI();
    // Погода по умолчанию
    updateWeather();
};