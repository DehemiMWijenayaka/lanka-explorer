 // ===== 1. LOAD DESTINATIONS =====

async function loadDestinations() {
    const response = await fetch('data/destinations.json');

    if (!response.ok) {
        throw new Error(
            'Could not load destinations (status ' + response.status + ')'
        );
    }

    const destinations = await response.json();
    return destinations;
}


// ===== 2. HELPER FUNCTIONS =====

// Format entry fee
function formatFee(fee) {
    if (Number(fee) === 0) {
        return 'Free';
    }

    return 'USD ' + fee;
}


// Get price category
function getPriceLabel(fee) {
    if (Number(fee) === 0) {
        return 'Free';
    } else if (fee <= 15) {
        return 'Budget';
    } else if (fee <= 30) {
        return 'Mid-range';
    } else {
        return 'Premium';
    }
}


// Get category badge class
function getCategoryClass(category) {
    switch (category) {
        case 'Heritage':
            return 'badge-heritage';

        case 'Beach':
            return 'badge-beach';

        case 'Nature':
            return 'badge-nature';

        case 'Wildlife':
            return 'badge-wildlife';

        default:
            return 'badge-other';
    }
}


// Create destination card
function createCard(place) {
    const card = document.createElement('article');
    card.className = 'card';

    // Prevent displaying "Free · Free"
    const feeText = Number(place.entryFeeUSD) === 0
        ? 'Entry: Free'
        : `Entry: ${formatFee(place.entryFeeUSD)} · ${getPriceLabel(place.entryFeeUSD)}`;

    card.innerHTML = `
        <img src="${place.image}" alt="${place.name}">

        <h3>${place.name}</h3>

        <p class="meta">
            <span class="badge ${getCategoryClass(place.category)}">
                ${place.category}
            </span>

            ${place.district} District
        </p>

        <p>${place.description}</p>

        <p class="fee">${feeText}</p>

        <a href="details.html?id=${place.id}">
            View details
        </a>
    `;

    return card;
}


// ===== 3. DARK MODE =====

const THEME_KEY = 'lankaExplorerTheme';

const themeToggle = document.querySelector('.theme-toggle');

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');

        if (themeToggle) {
            themeToggle.textContent = 'Light mode';
        }
    } else {
        document.body.classList.remove('dark');

        if (themeToggle) {
            themeToggle.textContent = 'Dark mode';
        }
    }
}


// Theme button click event
if (themeToggle) {
    themeToggle.addEventListener('click', function () {
        const newTheme =
            document.body.classList.contains('dark')
                ? 'light'
                : 'dark';

        localStorage.setItem(THEME_KEY, newTheme);
        applyTheme(newTheme);
    });

    // Restore saved theme
    applyTheme(
        localStorage.getItem(THEME_KEY) || 'light'
    );
}


// ===== 4. HOME PAGE =====

async function initHomePage() {
    const featuredSection = document.querySelector('#featured');

    if (!featuredSection) return;

    try {
        const destinations = await loadDestinations();

        const featured = destinations.filter(
            place => place.featured === true
        );

        for (const place of featured) {
            featuredSection.appendChild(createCard(place));
        }
    } catch (error) {
        showError(
            featuredSection,
            'Featured destinations could not be loaded.'
        );

        console.error(error);
    }
}


// ===== 5. DESTINATIONS PAGE =====

async function initDestinationsPage() {
    const list = document.querySelector('#destination-list');

    if (!list) return;

    const searchInput = document.querySelector('#search');
    const categorySelect = document.querySelector('#category');
    const sortSelect = document.querySelector('#sort');
    const resultCount = document.querySelector('#result-count');

    let allDestinations = [];

    showLoading(list, 'Loading destinations...');

    try {
        allDestinations = await loadDestinations();
    } catch (error) {
        showError(
            list,
            'Sorry, destinations could not be loaded. Please try again later.'
        );

        console.error(error);
        return;
    }

    function updateList() {
        const searchText =
            searchInput.value.trim().toLowerCase();

        const category = categorySelect.value;
        const sortBy = sortSelect.value;

        // FILTER
        const results = allDestinations.filter(function (place) {
            const matchesSearch =
                place.name.toLowerCase().includes(searchText) ||
                place.district.toLowerCase().includes(searchText) ||
                place.description.toLowerCase().includes(searchText);

            const matchesCategory =
                category === 'all' || place.category === category;

            return matchesSearch && matchesCategory;
        });

        // SORT
        if (sortBy === 'name') {
            results.sort((a, b) =>
                a.name.localeCompare(b.name)
            );
        } else if (sortBy === 'fee-low') {
            results.sort((a, b) =>
                a.entryFeeUSD - b.entryFeeUSD
            );
        } else if (sortBy === 'fee-high') {
            results.sort((a, b) =>
                b.entryFeeUSD - a.entryFeeUSD
            );
        }

        // DISPLAY CARDS
        list.innerHTML = '';

        if (results.length === 0) {
            list.innerHTML =
                '<p class="no-results">No destinations match your search.</p>';
        } else {
            for (const place of results) {
                list.appendChild(createCard(place));
            }
        }

        if (resultCount) {
            resultCount.textContent =
                `Showing ${results.length} of ${allDestinations.length} destinations`;
        }
    }

    // EVENT LISTENERS
    searchInput.addEventListener('input', updateList);
    categorySelect.addEventListener('change', updateList);
    sortSelect.addEventListener('change', updateList);

    updateList();
}


// ===== 6. API: WEATHER (Open-METEO) =====

function describeWeather(code) {
    if (code === 0) {
        return 'Clear sky';
    } else if (code <= 3) {
        return 'Partly cloudy';
    } else if (code === 45 || code === 48) {
        return 'Foggy';
    } else if (code >= 51 && code <= 57) {
        return 'Drizzle';
    } else if (code >= 61 && code <= 67) {
        return 'Rain';
    } else if (code >= 80 && code <= 82) {
        return 'Rain showers';
    } else if (code >= 95) {
        return 'Thunderstorm';
    } else {
        return 'Mixed conditions';
    }
}


async function showWeather(place) {
    const box = document.querySelector('#weather');

    if (!box) return;

    showLoading(box, 'Loading weather...');

    const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${place.lat}&longitude=${place.lng}`
        + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code'
        + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
        + '&timezone=Asia%2FColombo&forecast_days=3';

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Weather API error');
        }

        const data = await response.json();
        const current = data.current;
        const daily = data.daily;

        let forecastHtml = '';

        for (let i = 0; i < daily.time.length; i++) {
            const dayName = new Date(daily.time[i]).toLocaleDateString(
                'en-GB',
                {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                }
            );

            forecastHtml += `
                <div class="forecast-day">
                    <strong>${dayName}</strong>

                    <p>${describeWeather(daily.weather_code[i])}</p>

                    <p>
                        ${Math.round(daily.temperature_2m_max[i])}°
                        /
                        ${Math.round(daily.temperature_2m_min[i])}°C
                    </p>

                    <p>Rain: ${daily.precipitation_probability_max[i]}%</p>
                </div>
            `;
        }

        box.innerHTML = `
            <div class="weather-now">
                <p class="temp">
                    ${Math.round(current.temperature_2m)}°C
                </p>

                <p>${describeWeather(current.weather_code)}</p>

                <p>
                    Humidity ${current.relative_humidity_2m}%
                    ·
                    Wind ${current.wind_speed_10m} km/h
                </p>
            </div>

            <div class="forecast">
                ${forecastHtml}
            </div>
        `;
    } catch (error) {
        showError(
            box,
            'Weather is unavailable right now. Please try again later.'
        );

        console.error(error);
    }
}


// ===== 7. API: CURRENCY (FRANKFURTER) =====

let usdToLkrRate = null;

async function getUsdToLkrRate() {
    if (usdToLkrRate !== null) {
        return usdToLkrRate;
    }

    const response = await fetch(
        'https://api.frankfurter.dev/v2/rate/usd/lkr'
    );

    if (!response.ok) {
        throw new Error('Currency API error');
    }

    const data = await response.json();

    usdToLkrRate = data.rate;

    return usdToLkrRate;
}


// ===== 8. API: MAPS (LEAFLET + OPENSTREETMAP) =====

function addBaseLayer(map) {
    L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 19,

            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    ).addTo(map);
}


// Single destination map
function showMap(place) {
    const mapBox = document.querySelector('#map');

    if (!mapBox) return;

    if (typeof L === 'undefined') {
        mapBox.textContent = 'The map could not be loaded.';
        return;
    }

    mapBox.textContent = '';

    const map = L.map('map')
        .setView([place.lat, place.lng], 13);

    addBaseLayer(map);

    L.marker([place.lat, place.lng])
        .addTo(map)
        .bindPopup(
            `<strong>${place.name}</strong><br>${place.district} District`
        )
        .openPopup();
}


// All destinations map
function showAllDestinationsMap(destinations) {
    const mapBox = document.querySelector('#all-map');

    if (!mapBox) return;

    if (typeof L === 'undefined') {
        mapBox.textContent = 'The map could not be loaded.';
        return;
    }

    const map = L.map('all-map');

    addBaseLayer(map);

    const points = [];

    for (const place of destinations) {
        L.marker([place.lat, place.lng])
            .addTo(map)
            .bindPopup(`
                <strong>${place.name}</strong><br>
                ${place.category}<br>
                <a href="details.html?id=${place.id}">View details</a>
            `);

        points.push([place.lat, place.lng]);
    }

    if (points.length > 0) {
        map.fitBounds(points, {
            padding: [30, 30]
        });
    }
}


// Format LKR amount
function formatLkr(amount) {
    return 'Rs. ' + Math.round(amount).toLocaleString('en-LK');
}


// Convert entry fee to LKR
async function showFeeInLkr(place) {
    const feeBox = document.querySelector('#fee-lkr');

    if (!feeBox || Number(place.entryFeeUSD) === 0) return;

    try {
        const rate = await getUsdToLkrRate();

        feeBox.textContent =
            ` ≈ ${formatLkr(place.entryFeeUSD * rate)}`;
    } catch (error) {
        feeBox.textContent = '';
        console.error(error);
    }
}


// ===== 9. MY TRIP STORAGE =====

const TRIP_KEY = 'lankaExplorerTrip';
const TRAVELLERS_KEY = 'lankaExplorerTravellers';


// Get saved trip
function getTrip() {
    const saved = localStorage.getItem(TRIP_KEY);

    if (saved === null) {
        return [];
    }

    try {
        const trip = JSON.parse(saved);
        return Array.isArray(trip) ? trip : [];
    } catch (error) {
        console.error('Invalid saved trip:', error);
        return [];
    }
}


// Save trip
function saveTrip(trip) {
    localStorage.setItem(
        TRIP_KEY,
        JSON.stringify(trip)
    );

    updateTripCount();
}


// Check whether destination is already added
function isInTrip(id) {
    return getTrip().includes(id);
}


// Add destination
function addToTrip(id) {
    const trip = getTrip();

    if (!trip.includes(id)) {
        trip.push(id);
        saveTrip(trip);
    }
}


// Remove destination
function removeFromTrip(id) {
    const trip = getTrip().filter(
        tripId => tripId !== id
    );

    saveTrip(trip);
}


// Update navigation counter
function updateTripCount() {
    const link = document.querySelector(
        'nav a[href="trip.html"]'
    );

    if (!link) return;

    const count = getTrip().length;

    link.textContent = count > 0
        ? `My Trip (${count})`
        : 'My Trip';
}


// ===== 10. ADD TO MY TRIP BUTTON =====

function setupTripButton(place) {
    const button = document.querySelector('#add-to-trip');

    if (!button) return;

    // Update button label
    function refreshButton() {
        if (isInTrip(place.id)) {
            button.textContent = '✓ In My Trip (click to remove)';
            button.classList.add('added');
        } else {
            button.textContent = 'Add to My Trip';
            button.classList.remove('added');
        }
    }

    // Button click event
    button.addEventListener('click', function () {
        if (isInTrip(place.id)) {
            removeFromTrip(place.id);
        } else {
            addToTrip(place.id);
        }

        refreshButton();
    });

    refreshButton();
}


// ===== 11. MY TRIP PAGE =====

async function initTripPage() {
    const tableBody = document.querySelector(
        '#trip-table tbody'
    );

    if (!tableBody) return;

    const summary = document.querySelector('#trip-summary');
    const travellersInput = document.querySelector('#travellers');
    const totalUsdCell = document.querySelector('#total-usd');
    const totalLkrCell = document.querySelector('#total-lkr');
    const clearButton = document.querySelector('#clear-trip');

    showLoading(summary, 'Loading your trip...');

    // Load all destinations
    let allDestinations = [];

    try {
        allDestinations = await loadDestinations();
    } catch (error) {
        showError(summary, 'Sorry, your trip could not be loaded.');
        console.error(error);
        return;
    }

    // Get USD to LKR exchange rate
    let rate = null;

    try {
        rate = await getUsdToLkrRate();
    } catch (error) {
        console.error(error);
    }

    // Restore saved travellers count
    travellersInput.value =
        localStorage.getItem(TRAVELLERS_KEY) || 1;

    // Display trip details and calculate totals
    function renderTrip() {
        const tripIds = getTrip();

        const places = allDestinations.filter(
            place => tripIds.includes(place.id)
        );

        const travellers = Math.max(
            1,
            Math.min(20, Number(travellersInput.value) || 1)
        );

        travellersInput.value = travellers;
        tableBody.innerHTML = '';

        // Empty trip message
        if (places.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-results">
                        Your trip is empty.

                        <a href="destinations.html">
                            Browse destinations
                        </a>

                        to add some.
                    </td>
                </tr>
            `;
        }

        // Calculate total fee per person
        let totalPerPerson = 0;

        // Create destination rows
        for (const place of places) {
            const fee = Number(place.entryFeeUSD) || 0;

            totalPerPerson += fee;

            const row = document.createElement('tr');

            row.innerHTML = `
                <td>
                    <a href="details.html?id=${place.id}">
                        ${place.name}
                    </a>
                </td>

                <td>
                    <span class="badge ${getCategoryClass(place.category)}">
                        ${place.category}
                    </span>
                </td>

                <td>
                    ${formatFee(fee)}
                </td>

                <td>
                    ${rate !== null
                        ? formatLkr(fee * rate)
                        : 'Unavailable'}
                </td>

                <td>
                    <button
                        type="button"
                        class="remove-btn"
                        data-id="${place.id}"
                    >
                        Remove
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        }

        // Calculate total for all travellers
        const groupTotal = totalPerPerson * travellers;

        // Display USD total
        totalUsdCell.textContent =
            'USD ' + groupTotal.toFixed(2);

        // Calculate and display LKR total
        totalLkrCell.textContent = rate !== null
            ? formatLkr(groupTotal * rate)
            : 'Unavailable';

        // Update trip summary
        summary.textContent =
            `${places.length} destination(s) for ${travellers} traveller(s).`;

        if (rate !== null) {
            summary.textContent +=
                ` Exchange rate used: 1 USD = Rs. ${rate.toFixed(2)}.`;
        }

        // Hide clear button when trip is empty
        clearButton.hidden = places.length === 0;
    }

    // Remove button event delegation
    tableBody.addEventListener('click', function (event) {
        if (event.target.classList.contains('remove-btn')) {
            const id = Number(event.target.dataset.id);

            removeFromTrip(id);
            renderTrip();
        }
    });

    // Travellers input event
    travellersInput.addEventListener('input', function () {
        const travellers = Math.max(
            1,
            Math.min(20, Number(travellersInput.value) || 1)
        );

        localStorage.setItem(
            TRAVELLERS_KEY,
            travellers
        );

        renderTrip();
    });

    // Clear all destinations
    clearButton.addEventListener('click', function () {
        if (confirm('Remove every destination from your trip?')) {
            saveTrip([]);
            renderTrip();
        }
    });

    // Initial display
    renderTrip();
}


// ===== 12. DETAILS PAGE =====

async function initDetailsPage() {
    const container = document.querySelector('#destination');

    if (!container) return;

    // Get ID from URL
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('id'));

    try {
        const destinations = await loadDestinations();

        const place = destinations.find(p => p.id === id);

        // If destination does not exist
        if (!place) {
            container.innerHTML = `
                <h1>Destination not found</h1>

                <p>
                    <a href="destinations.html">
                        Back to all destinations
                    </a>
                </p>
            `;

            const tripButton =
                document.querySelector('#add-to-trip');

            if (tripButton) {
                tripButton.hidden = true;
            }

            return;
        }

        // Change browser tab title
        document.title = `${place.name} | Lanka Explorer`;

        // Prepare entry fee text without duplicate "Free"
        const feeText = Number(place.entryFeeUSD) === 0
            ? 'Free'
            : `${formatFee(place.entryFeeUSD)} (${getPriceLabel(place.entryFeeUSD)})`;

        // Display destination details
        container.innerHTML = `
            <img src="${place.image}" alt="${place.name}">

            <h1>${place.name}</h1>

            <p class="meta">
                <span class="badge ${getCategoryClass(place.category)}">
                    ${place.category}
                </span>

                ${place.district} District
            </p>

            <p>${place.description}</p>

            <h2>Quick Facts</h2>

            <ul>
                <li>
                    <strong>Entry fee:</strong>
                    ${feeText}
                    <span id="fee-lkr"></span>
                </li>
            </ul>
        `;

        // Load weather, currency, map and trip button
        showWeather(place);
        showFeeInLkr(place);
        showMap(place);
        setupTripButton(place);

    } catch (error) {
        container.innerHTML =
            '<p class="error">Sorry, this destination could not be loaded.</p>';

        console.error(error);
    }
}


// ===== 13. LOADING AND ERROR MESSAGES =====

function showLoading(element, text) {
    if (!element) return;

    element.innerHTML = `
        <div class="loading">
            <span class="spinner"></span>
            <span>${text}</span>
        </div>
    `;
}


function showError(element, text) {
    if (!element) return;

    element.innerHTML = `
        <p class="error">${text}</p>
    `;
}


// ===== 14. ENQUIRY FORM =====

function initEnquiryForm() {
    const form = document.querySelector('#enquiry-form');

    if (!form) return;

    const message = document.querySelector('#form-message');

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        const name =
            document.querySelector('#name').value.trim();

        const email =
            document.querySelector('#email').value.trim();

        const date =
            document.querySelector('#date').value;

        const people =
            Number(document.querySelector('#people').value);

        const interests =
            form.querySelectorAll('input[name="interest"]:checked');

        // Message length
        const messageText =
            document.querySelector('#message').value.trim();

        const errors = [];

        // Name validation
        if (name.length < 3) {
            errors.push(
                'Please enter your full name (at least 3 characters).'
            );
        }

        // Email validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            errors.push('Please enter a valid email address.');
        }

        // Date validation
        if (date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (new Date(date) < today) {
                errors.push(
                    'The travel date cannot be in the past.'
                );
            }
        }

        // Number of travellers
        if (people < 1 || people > 20 || !Number.isFinite(people)) {
            errors.push(
                'Number of travellers must be between 1 and 20.'
            );
        }

        // Interest validation
        if (interests.length === 0) {
            errors.push('Please choose at least one interest.');
        }

        // Message validation
        if (messageText.length > 500) {
            errors.push(
                'Message must be no longer than 500 characters.'
            );
        }

        // Display errors or success
        if (errors.length > 0) {
            message.className = 'form-error';

            message.innerHTML =
                '<ul>' +
                errors.map(e => `<li>${e}</li>`).join('') +
                '</ul>';
        } else {
            message.className = 'form-success';

            message.textContent =
                `Thank you, ${name}! We will contact you at ${email} within 24 hours.`;

            form.reset();
        }
    });
}


// ===== 15. START THE APP =====

initHomePage();

initDestinationsPage();

initDetailsPage();

initEnquiryForm();

updateTripCount();

initTripPage();
