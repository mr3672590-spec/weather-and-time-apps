
"use strict";

/* =========================================
   ATMOS — WEATHER, TIME & DATE APP
   Live data: Open-Meteo APIs
========================================= */

const API = {
  forecast: "https://api.open-meteo.com/v1/forecast",
  geocoding: "https://geocoding-api.open-meteo.com/v1/search"
};

const DEFAULT_CITY = {
  name: "Sherpur",
  admin1: "Mymensingh Division",
  country: "Bangladesh",
  latitude: 25.0188,
  longitude: 90.0175,
  timezone: "Asia/Dhaka"
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  searchForm: $("#searchForm"),
  cityInput: $("#cityInput"),
  searchButton: $("#searchForm button[type='submit']"),
  searchResults: $("#searchResults"),
  statusMessage: $("#statusMessage"),
  locationButton: $("#locationButton"),
  unitToggle: $("#unitToggle"),
  themeToggle: $("#themeToggle"),

  locationName: $("#locationName"),
  locationDetails: $("#locationDetails"),
  weatherDescription: $("#weatherDescription"),
  weatherArt: $("#weatherArt"),
  temperature: $("#temperature"),
  temperatureUnit: $("#temperatureUnit"),
  feelsLike: $("#feelsLike"),
  feelsMetric: $("#feelsMetric"),
  highLow: $("#highLow"),
  humidity: $("#humidity"),
  windSpeed: $("#windSpeed"),
  rainChance: $("#rainChance"),
  updatedAt: $("#updatedAt"),

  clock: $("#clock"),
  ampm: $("#ampm"),
  date: $("#date"),
  timezone: $("#timezone"),
  forecast: $("#forecast")
};

let selectedCity = { ...DEFAULT_CITY };
let latestWeather = null;
let temperatureUnit = "C";
let searchSequence = 0;
let weatherSequence = 0;
let isLoading = false;

const weatherCodes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Moderate drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Slight rain", "🌦️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Slight snowfall", "🌨️"],
  73: ["Moderate snowfall", "🌨️"],
  75: ["Heavy snowfall", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Moderate showers", "🌧️"],
  82: ["Violent rain showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Heavy thunderstorm", "⛈️"]
};

function getWeatherInfo(code, isDay = 1) {
  const info = weatherCodes[code] || ["Unknown conditions", "🌡️"];

  if (code === 0 && !isDay) {
    return ["Clear night", "🌙"];
  }

  if (code === 1 && !isDay) {
    return ["Mostly clear night", "🌙"];
  }

  if (code === 2 && !isDay) {
    return ["Partly cloudy night", "☁️"];
  }

  return info;
}

function toFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

function displayTemperature(value, decimals = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "--";
  }

  const result = temperatureUnit === "F"
    ? toFahrenheit(Number(value))
    : Number(value);

  return result.toFixed(decimals);
}

function temperatureLabel(value) {
  return `${displayTemperature(value)}°${temperatureUnit}`;
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function setLoading(loading) {
  isLoading = loading;
  elements.searchButton.disabled = loading;
  elements.searchButton.innerHTML = loading
    ? "Loading..."
    : 'Search <span>↗</span>';
}

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.reason || "Weather service returned an error.");
  }

  return data;
}

/* =========================================
   CITY SEARCH
========================================= */

function hideSearchResults() {
  elements.searchResults.replaceChildren();
  elements.searchResults.hidden = true;
}

function showSearchResults(results) {
  elements.searchResults.replaceChildren();

  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "result-button";
    empty.textContent = "No matching cities found. Try another name.";
    elements.searchResults.appendChild(empty);
    elements.searchResults.hidden = false;
    return;
  }

  results.forEach((city) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-button";

    const name = document.createElement("span");
    name.textContent = city.name;

    const details = document.createElement("small");
    details.textContent = [
      city.admin1,
      city.country
    ].filter(Boolean).join(", ");

    button.append(name, details);

    button.addEventListener("click", () => {
      selectedCity = {
        name: city.name,
        admin1: city.admin1 || "",
        country: city.country || "",
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone || "auto"
      };

      elements.cityInput.value = city.name;
      hideSearchResults();
      loadWeather();
    });

    elements.searchResults.appendChild(button);
  });

  elements.searchResults.hidden = false;
}

async function searchCity(query) {
  const sequence = ++searchSequence;

  const url = new URL(API.geocoding);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  setStatus("Searching for cities...");

  try {
    const data = await fetchJSON(url);

    if (sequence !== searchSequence) return;

    showSearchResults(data.results || []);
    setStatus(data.results?.length
      ? "Choose a matching city from the results."
      : "No cities found. Check your spelling.");
  } catch (error) {
    if (sequence !== searchSequence) return;

    hideSearchResults();
    setStatus("City search failed. Check your internet connection.");
    console.error("City search:", error);
  }
}

elements.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = elements.cityInput.value.trim();

  if (query.length < 2) {
    setStatus("Enter at least two characters.");
    return;
  }

  hideSearchResults();
  setLoading(true);

  try {
    await searchCity(query);
  } finally {
    setLoading(false);
  }
});

elements.cityInput.addEventListener("input", () => {
  searchSequence++;
  hideSearchResults();
});

document.addEventListener("click", (event) => {
  if (
    !elements.searchForm.contains(event.target) &&
    !elements.searchResults.contains(event.target)
  ) {
    hideSearchResults();
  }
});

/* =========================================
   FETCH LIVE WEATHER + 7-DAY FORECAST
========================================= */

async function loadWeather() {
  const sequence = ++weatherSequence;
  const city = { ...selectedCity };

  setStatus("Fetching live weather...");
  elements.updatedAt.textContent = "Updating weather data...";

  const url = new URL(API.forecast);

  url.searchParams.set("latitude", city.latitude);
  url.searchParams.set("longitude", city.longitude);

  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m"
    ].join(",")
  );

  url.searchParams.set(
    "hourly",
    "precipitation_probability"
  );

  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset"
    ].join(",")
  );

  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  try {
    const data = await fetchJSON(url);

    if (sequence !== weatherSequence) return;

    if (!data.current || !data.daily) {
      throw new Error("Weather data is incomplete.");
    }

    latestWeather = data;

    selectedCity.timezone = data.timezone || city.timezone;

    renderWeather(data, city);
    renderForecast(data.daily);
    updateClock();

    setStatus("Weather updated successfully.");
  } catch (error) {
    if (sequence !== weatherSequence) return;

    console.error("Weather API:", error);

    setStatus("Unable to load weather. Please try again.");
    elements.weatherDescription.textContent = "Weather unavailable";
    elements.updatedAt.textContent =
      "Check your internet connection and try searching again.";
    elements.forecast.replaceChildren();

    const message = document.createElement("p");
    message.className = "forecast-loading";
    message.textContent = "Forecast unavailable. Please try again.";
    elements.forecast.appendChild(message);
  }
}

function renderWeather(data, city) {
  const current = data.current;
  const daily = data.daily;

  const cityName = city.name || "Selected location";
  const cityDetails = [city.admin1, city.country]
    .filter(Boolean)
    .join(", ");

  elements.locationName.textContent = cityName;
  elements.locationDetails.textContent =
    cityDetails || "Selected location";

  const info = getWeatherInfo(
    current.weather_code,
    current.is_day
  );

  elements.weatherDescription.textContent = info[0];
  elements.weatherArt.textContent = info[1];

  elements.temperature.textContent =
    displayTemperature(current.temperature_2m);

  elements.temperatureUnit.textContent = `°${temperatureUnit}`;

  elements.feelsLike.textContent =
    temperatureLabel(current.apparent_temperature);

  elements.feelsMetric.textContent =
    temperatureLabel(current.apparent_temperature);

  elements.humidity.textContent =
    `${Math.round(current.relative_humidity_2m)}%`;

  elements.windSpeed.textContent =
    `${Math.round(current.wind_speed_10m)} km/h`;

  const maxTemp = daily.temperature_2m_max?.[0];
  const minTemp = daily.temperature_2m_min?.[0];

  elements.highLow.textContent =
    `H: ${displayTemperature(maxTemp)}°  L: ${displayTemperature(minTemp)}°`;

  const rainChance = getCurrentRainChance(data);

  elements.rainChance.textContent =
    rainChance === null ? "N/A" : `${rainChance}%`;

  elements.updatedAt.textContent =
    `Weather observation: ${formatCityTime(current.time, data.timezone)}`;

  elements.timezone.textContent =
    data.timezone || city.timezone || "Local timezone";
}

function getCurrentRainChance(data) {
  const hourly = data.hourly;
  const currentTime = data.current?.time;

  if (
    !hourly?.time?.length ||
    !hourly?.precipitation_probability?.length ||
    !currentTime
  ) {
    return null;
  }

  let bestIndex = 0;
  let smallestDifference = Infinity;

  const currentTimestamp = new Date(currentTime).getTime();

  hourly.time.forEach((time, index) => {
    const timestamp = new Date(time).getTime();
    const difference = Math.abs(timestamp - currentTimestamp);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      bestIndex = index;
    }
  });

  const probability = hourly.precipitation_probability[bestIndex];

  return probability == null ? null : Math.round(probability);
}

function formatCityTime(isoTime, timezone) {
  if (!isoTime) return "Latest available data";

  const date = new Date(isoTime);

  if (Number.isNaN(date.getTime())) return isoTime;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

/* =========================================
   7-DAY FORECAST
========================================= */

function renderForecast(daily) {
  elements.forecast.replaceChildren();

  if (!daily?.time?.length) {
    const message = document.createElement("p");
    message.className = "forecast-loading";
    message.textContent = "No forecast data available.";
    elements.forecast.appendChild(message);
    return;
  }

  daily.time.forEach((dateString, index) => {
    const day = document.createElement("article");
    day.className = "forecast-day";

    const date = new Date(`${dateString}T12:00:00`);
    const dayName = index === 0
      ? "Today"
      : new Intl.DateTimeFormat("en", {
          weekday: "short"
        }).format(date);

    const code = daily.weather_code[index];
    const info = getWeatherInfo(code, 1);

    const name = document.createElement("p");
    name.className = "forecast-name";
    name.textContent = dayName;

    const icon = document.createElement("span");
    icon.className = "forecast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = info[1];

    const description = document.createElement("p");
    description.className = "forecast-description";
    description.textContent = info[0];

    const temperatures = document.createElement("div");
    temperatures.className = "forecast-temps";

    const max = document.createElement("strong");
    max.textContent = `${displayTemperature(
      daily.temperature_2m_max[index]
    )}°`;

    const min = document.createElement("span");
    min.textContent = `${displayTemperature(
      daily.temperature_2m_min[index]
    )}°`;

    temperatures.append(max, min);

    const rain = document.createElement("p");
    rain.className = "forecast-rain";

    const probability = daily.precipitation_probability_max?.[index];

    rain.textContent = probability == null
      ? "Rain: N/A"
      : `☔ ${Math.round(probability)}%`;

    day.append(name, icon, description, temperatures, rain);
    elements.forecast.appendChild(day);
  });
}

/* =========================================
   LIVE CLOCK + DATE
========================================= */

function updateClock() {
  const timezone = selectedCity.timezone || "Asia/Dhaka";
  const now = new Date();

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).formatToParts(now);

    const getPart = (type) =>
      parts.find((part) => part.type === type)?.value || "";

    const hour = getPart("hour");
    const minute = getPart("minute");
    const second = getPart("second");
    const dayPeriod = getPart("dayPeriod");

    elements.clock.textContent = `${hour}:${minute}:${second}`;
    elements.ampm.textContent = dayPeriod;

    elements.date.textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(now);

    elements.timezone.textContent = timezone;
  } catch (error) {
    console.error("Clock timezone:", error);

    elements.clock.textContent = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);

    elements.date.textContent = now.toLocaleDateString();
  }
}

updateClock();
setInterval(updateClock, 1000);

/* =========================================
   TEMPERATURE UNIT SWITCH
========================================= */

elements.unitToggle.addEventListener("click", () => {
  temperatureUnit = temperatureUnit === "C" ? "F" : "C";

  elements.unitToggle.textContent = `°${temperatureUnit}`;

  if (latestWeather) {
    renderWeather(latestWeather, selectedCity);
    renderForecast(latestWeather.daily);
  }
});

/* =========================================
   DARK / LIGHT MODE
========================================= */

elements.themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-mode");

  elements.themeToggle.textContent = isLight ? "☾" : "☼";

  const themeColor = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (themeColor) {
    themeColor.content = isLight ? "#f2f6ff" : "#080d19";
  }
});

/* =========================================
   USER LOCATION
========================================= */

elements.locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported by this browser.");
    return;
  }

  setStatus("Requesting your location...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      selectedCity = {
        name: "Your location",
        admin1: "",
        country: "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: "auto"
      };

      hideSearchResults();
      await loadWeather();

      // Resolve the nearest named city for display.
      // Weather still works if reverse geocoding fails.
      try {
        const reverseUrl = new URL(API.geocoding);
        reverseUrl.searchParams.set(
          "latitude",
          position.coords.latitude
        );
        reverseUrl.searchParams.set(
          "longitude",
          position.coords.longitude
        );
        reverseUrl.searchParams.set("count", "1");
        reverseUrl.searchParams.set("language", "en");
        reverseUrl.searchParams.set("format", "json");

        const geo = await fetchJSON(reverseUrl);
        const nearest = geo.results?.[0];

        if (nearest) {
          selectedCity.name = nearest.name;
          selectedCity.admin1 = nearest.admin1 || "";
          selectedCity.country = nearest.country || "";
          selectedCity.latitude = nearest.latitude;
          selectedCity.longitude = nearest.longitude;
          selectedCity.timezone =
            nearest.timezone || selectedCity.timezone;

          await loadWeather();
        }
      } catch (error) {
        console.warn("Could not resolve nearby city:", error);
      }
    },
    (error) => {
      const messages = {
        1: "Location permission denied. Allow location access in your browser.",
        2: "Your location is unavailable. Try searching for a city.",
        3: "Location request timed out. Please try again."
      };

      setStatus(
        messages[error.code] ||
        "Could not get your location. Search for a city instead."
      );
    },
    {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 300000
    }
  );
});

/* =========================================
   START APP
========================================= */

loadWeather();
