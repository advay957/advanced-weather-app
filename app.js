const apiKey = '2350ecafed26b115b1557305d956630d'; // Provided key

const state = {
    city: 'New York',
    unit: 'metric', // metric | imperial
    lat: null,
    lon: null,
    favorites: JSON.parse(localStorage.getItem('aether_favs') || '[]')
};

const elements = {
    cityInput: document.getElementById('cityInput'),
    locationName: document.getElementById('locationName'),
    currentDate: document.getElementById('currentDate'),
    currentTemp: document.getElementById('currentTemp'),
    weatherIcon: document.getElementById('weatherIcon'),
    weatherDesc: document.getElementById('weatherDesc'),
    tempMax: document.getElementById('tempMax'),
    tempMin: document.getElementById('tempMin'),
    humidityVal: document.getElementById('humidityVal'),
    humidityDesc: document.getElementById('humidityDesc'),
    visibilityVal: document.getElementById('visibilityVal'),
    visibilityDesc: document.getElementById('visibilityDesc'),
    pressureVal: document.getElementById('pressureVal'),
    windSpeed: document.getElementById('windSpeed'),
    windDir: document.getElementById('windDir'),
    windArrow: document.getElementById('windArrow'),
    sunriseTime: document.getElementById('sunriseTime'),
    sunsetTime: document.getElementById('sunsetTime'),
    aqiValue: document.getElementById('aqiValue'),
    aqiLabel: document.getElementById('aqiLabel'),
    forecastList: document.getElementById('forecastList'),
    sidebarFavorites: document.getElementById('sidebarFavorites'),
    unitToggle: document.getElementById('unitToggle'),
    addToFavBtn: document.getElementById('addToFavBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    navItems: document.querySelectorAll('.nav-item'),
    views: {
        dashboard: document.getElementById('dashboardView'),
        map: document.getElementById('mapView'),
        saved: document.getElementById('savedView')
    }
};

let mapInstance = null;
let chartInstance = null;

// --- Initialization ---
function init() {
    renderFavorites();
    fetchWeatherData(state.city);

    // Event Listeners
    elements.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = e.target.value.trim();
            if (city) fetchWeatherData(city);
        }
    });

    elements.unitToggle.addEventListener('click', toggleUnit);
    elements.addToFavBtn.addEventListener('click', toggleFavorite);
    elements.refreshBtn.addEventListener('click', () => fetchWeatherData(state.city));

    elements.navItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });
}

// --- API Calls ---
async function fetchWeatherData(query) {
    try {
        // 1. Current Weather
        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${query}&units=${state.unit}&appid=${apiKey}`);
        if (!weatherRes.ok) throw new Error('City not found');
        const weather = await weatherRes.json();

        state.lat = weather.coord.lat;
        state.lon = weather.coord.lon;
        state.city = weather.name;

        // 2. Forecast (5 day / 3 hour)
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${state.lat}&lon=${state.lon}&units=${state.unit}&appid=${apiKey}`);
        const forecast = await forecastRes.json();

        // 3. Air Pollution
        const aqiRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${state.lat}&lon=${state.lon}&appid=${apiKey}`);
        const aqi = await aqiRes.json();

        updateUI(weather, forecast, aqi);
        updateMap(state.lat, state.lon);
        updateBackground(weather);

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// --- UI Updates ---
function updateUI(weather, forecast, aqi) {
    // Header
    elements.locationName.textContent = `${weather.name}, ${weather.sys.country}`;
    elements.currentDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

    // Hero
    elements.currentTemp.textContent = Math.round(weather.main.temp);
    elements.weatherDesc.textContent = weather.weather[0].description;
    elements.weatherIcon.src = `https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`;
    elements.tempMax.textContent = Math.round(weather.main.temp_max);
    elements.tempMin.textContent = Math.round(weather.main.temp_min);

    // Metrics
    elements.humidityVal.textContent = weather.main.humidity;
    elements.humidityDesc.textContent = getHumidityDesc(weather.main.humidity);

    elements.pressureVal.textContent = weather.main.pressure;

    const visKm = (weather.visibility / 1000).toFixed(1);
    elements.visibilityVal.textContent = visKm;
    elements.visibilityDesc.textContent = getVisibilityDesc(visKm);

    elements.windSpeed.textContent = Math.round(weather.wind.speed);
    elements.windDir.textContent = getWindDir(weather.wind.deg);
    elements.windArrow.style.transform = `rotate(${weather.wind.deg}deg)`;

    elements.sunriseTime.textContent = new Date(weather.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    elements.sunsetTime.textContent = new Date(weather.sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // AQI
    if (aqi && aqi.list && aqi.list.length > 0) {
        const aqiLevel = aqi.list[0].main.aqi;
        const aqiMap = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
        elements.aqiValue.textContent = aqiLevel;
        elements.aqiLabel.textContent = aqiMap[aqiLevel];

        // Pollutants
        const p = aqi.list[0].components;
        const pollutantsDiv = document.getElementById('pollutants');
        if (pollutantsDiv) {
            pollutantsDiv.innerHTML = `
            <div class="pollutant-item"><span>PM2.5</span> <span>${p.pm2_5}</span></div>
            <div class="pollutant-item"><span>NO2</span> <span>${p.no2}</span></div>
        `;
        }
    }

    // UV Index (Mocked/Estimated)
    const uvVal = Math.max(0, Math.round((100 - weather.clouds.all) / 10));
    document.getElementById('uvValue').textContent = uvVal;
    const uvMeter = document.getElementById('uvMeter');
    if (uvMeter) {
        uvMeter.style.background = `conic-gradient(var(--accent) ${uvVal * 10}%, rgba(255,255,255,0.1) 0)`;
    }

    // Charts & Lists
    renderHourlyChart(forecast.list.slice(0, 8)); // Next 24h (approx)
    renderForecastList(forecast.list);

    updateFavIcon();
}

function updateBackground(weather) {
    const body = document.body;
    body.className = ''; // Reset

    const condition = weather.weather[0].main.toLowerCase();
    const isNight = weather.weather[0].icon.includes('n');

    if (condition.includes('clear')) {
        body.classList.add(isNight ? 'bg-default' : 'bg-clear');
    }
    else if (condition.includes('cloud')) body.classList.add('bg-cloudy');
    else if (condition.includes('rain') || condition.includes('drizzle')) body.classList.add('bg-rain');
    else if (condition.includes('snow')) body.classList.add('bg-snow');
    else if (condition.includes('thunder')) body.classList.add('bg-thunder');
    else body.classList.add('bg-default');
}

function renderHourlyChart(hourlyData) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    const labels = hourlyData.map(item => new Date(item.dt * 1000).getHours() + ':00');
    const temps = hourlyData.map(item => Math.round(item.main.temp));
    const pops = hourlyData.map(item => Math.round(item.pop * 100));

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temp (°)',
                    data: temps,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Rain (%)',
                    data: pops,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167, 139, 250, 0.2)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                y: {
                    display: false,
                    position: 'left'
                },
                y1: {
                    display: false,
                    position: 'right',
                    min: 0,
                    max: 100
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function renderForecastList(list) {
    elements.forecastList.innerHTML = '';
    const daily = {};
    list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString();
        if (!daily[date]) daily[date] = [];
        daily[date].push(item);
    });

    Object.keys(daily).slice(0, 5).forEach(date => {
        const items = daily[date];
        const dayName = new Date(items[0].dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });
        const icon = items[Math.floor(items.length / 2)].weather[0].icon;

        const temps = items.map(i => i.main.temp);
        const min = Math.round(Math.min(...temps));
        const max = Math.round(Math.max(...temps));

        const div = document.createElement('div');
        div.className = 'forecast-item';
        div.innerHTML = `
      <div class="forecast-day">${dayName}</div>
      <div class="forecast-icon"><img src="https://openweathermap.org/img/wn/${icon}.png" alt=""></div>
      <div class="forecast-temps">
        <span class="max">${max}°</span>
        <span class="min">${min}°</span>
      </div>
    `;
        elements.forecastList.appendChild(div);
    });
}

// --- Map ---
function updateMap(lat, lon) {
    if (!mapInstance) {
        mapInstance = L.map('weatherMap').setView([lat, lon], 10);

        const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap, &copy; CartoDB'
        });

        baseLayer.addTo(mapInstance);

        // Weather Layers
        const clouds = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`, { maxZoom: 19 });
        const precip = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`, { maxZoom: 19 });
        const temp = L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`, { maxZoom: 19 });

        const overlays = {
            "Clouds": clouds,
            "Precipitation": precip,
            "Temperature": temp
        };

        L.control.layers(null, overlays).addTo(mapInstance);

        L.marker([lat, lon]).addTo(mapInstance);

    } else {
        mapInstance.setView([lat, lon], 10);
        mapInstance.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                layer.setLatLng([lat, lon]);
            }
        });
    }
}

// --- Helpers ---
function getHumidityDesc(h) {
    if (h < 30) return 'Dry';
    if (h < 60) return 'Comfortable';
    return 'Humid';
}

function getVisibilityDesc(km) {
    if (km > 10) return 'Excellent';
    if (km > 5) return 'Good';
    return 'Poor';
}

function getWindDir(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}

function toggleUnit() {
    state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
    document.querySelector('.unit-c').classList.toggle('active');
    document.querySelector('.unit-f').classList.toggle('active');
    fetchWeatherData(state.city);
}

function switchView(viewName) {
    elements.navItems.forEach(btn => {
        if (btn.dataset.view === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    Object.values(elements.views).forEach(el => {
        if (el) el.classList.add('hidden');
    });

    if (elements.views[viewName]) {
        elements.views[viewName].classList.remove('hidden');
        if (viewName === 'map' && mapInstance) mapInstance.invalidateSize();
    }
}

// --- Favorites ---
function toggleFavorite() {
    const idx = state.favorites.indexOf(state.city);
    if (idx === -1) {
        state.favorites.push(state.city);
    } else {
        state.favorites.splice(idx, 1);
    }
    localStorage.setItem('aether_favs', JSON.stringify(state.favorites));
    updateFavIcon();
    renderFavorites();
}

function updateFavIcon() {
    const icon = elements.addToFavBtn.querySelector('i');
    if (state.favorites.includes(state.city)) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        icon.style.color = '#ef4444';
    } else {
        icon.classList.add('fa-regular');
        icon.classList.remove('fa-solid');
        icon.style.color = 'white';
    }
}

function renderFavorites() {
    elements.sidebarFavorites.innerHTML = '';
    state.favorites.forEach(city => {
        const btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${city}`;
        btn.onclick = () => fetchWeatherData(city);
        elements.sidebarFavorites.appendChild(btn);
    });
}

// Start
init();
