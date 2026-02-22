// КОНФИГУРАЦИЯ - ВАШ РАБОЧИЙ URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwP6g8s_gy7BFV0bfuBRk5xeTf3BTXrmo931GuQK5wtbY3kenQUbMC0Hidd93Aa6xgR/exec';

// Состояние приложения
let isAdmin = false;
let applications = [];
let holidays = [];
let vacancies = [];
let chatMessages = {};
let deleteTarget = null;
let clickCount = 0;
let clickTimer = null;
let audioContext = null;
let lastCheckTimestamp = Date.now();

// Константы
const STORAGE_KEYS = {
    AUTH: 'oskolkiAuth',
    HOLIDAYS: 'oskolkiHolidays',
    VACANCIES: 'oskolkiVacancies',
    CHAT: 'oskolkiChat'
};

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Сайт Осколки загружается...');
    
    // Проверяем сохраненную авторизацию
    checkStoredAuth();
    
    // Загружаем данные
    await loadAllData();
    loadLocalData();
    
    // Настраиваем обработчики
    setupEventListeners();
    
    // Обновляем интерфейс
    updateAdminUI();
    updateHolidayBanner();
    renderPublicVacancies();
    
    // Запускаем проверку новых данных (каждые 10 секунд)
    if (isAdmin) {
        setInterval(checkForNewData, 10000);
    }
    
    console.log('✅ Сайт готов. Админ:', isAdmin);
});

// Проверка сохраненной авторизации
function checkStoredAuth() {
    try {
        const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
        if (savedAuth === 'true') {
            console.log('🔓 Найдена сохраненная авторизация');
            isAdmin = true;
        } else {
            console.log('🔒 Авторизация не найдена');
            isAdmin = false;
        }
    } catch (e) {
        console.error('Ошибка проверки авторизации:', e);
        isAdmin = false;
    }
}

// Загрузка всех данных
async function loadAllData() {
    try {
        // Загружаем заявки
        const appsResponse = await fetch(`${APPS_SCRIPT_URL}?sheet=Заявки&t=${Date.now()}`);
        const appsData = await appsResponse.json();
        if (appsData && appsData.data) {
            applications = appsData.data;
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
            console.log('📥 Загружено заявок:', applications.length);
        }
        
        // Загружаем праздники
        const holResponse = await fetch(`${APPS_SCRIPT_URL}?sheet=Праздники&t=${Date.now()}`);
        const holData = await holResponse.json();
        if (holData && holData.data) {
            holidays = holData.data;
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
        }
        
        // Загружаем чат
        const chatResponse = await fetch(`${APPS_SCRIPT_URL}?sheet=Чат&t=${Date.now()}`);
        const chatData = await chatResponse.json();
        if (chatData && chatData.data) {
            const messages = chatData.data;
            chatMessages = {};
            messages.forEach(msg => {
                if (!chatMessages[msg.applicationId]) {
                    chatMessages[msg.applicationId] = [];
                }
                chatMessages[msg.applicationId].push(msg);
            });
            localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatMessages));
        }
        
        lastCheckTimestamp = Date.now();
    } catch (error) {
        console.error('Ошибка загрузки из Google Sheets:', error);
        loadLocalData();
    }
}

// Загрузка локальных данных
function loadLocalData() {
    try {
        const savedApps = localStorage.getItem('oskolkiApplications');
        if (savedApps) {
            applications = JSON.parse(savedApps);
        }
        
        const savedHolidays = localStorage.getItem(STORAGE_KEYS.HOLIDAYS);
        if (savedHolidays) {
            holidays = JSON.parse(savedHolidays);
        } else {
            // Праздники по умолчанию
            holidays = [
                { id: '1', name: 'День колбасы', date: new Date().toISOString().split('T')[0] }
            ];
        }
        
        const savedVacancies = localStorage.getItem(STORAGE_KEYS.VACANCIES);
        if (savedVacancies) {
            vacancies = JSON.parse(savedVacancies);
        } else {
            vacancies = [
                { id: '1', title: 'Обвальщик', description: 'Опыт работы от 1 года', salaryMin: 70000, salaryMax: 90000 },
                { id: '2', title: 'Фаршесоставитель', description: 'Знание рецептур', salaryMin: 65000, salaryMax: 85000 }
            ];
        }
        
        const savedChat = localStorage.getItem(STORAGE_KEYS.CHAT);
        if (savedChat) {
            chatMessages = JSON.parse(savedChat);
        }
    } catch (e) {
        console.error('Ошибка загрузки локальных данных:', e);
    }
}

// Сохранение в Google Sheets
async function saveToSheet(sheetName, data) {
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sheet: sheetName,
                data: data
            })
        });
        
        // Сохраняем локально
        if (sheetName === 'Заявки') {
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
        } else if (sheetName === 'Праздники') {
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
        } else if (sheetName === 'Чат') {
            localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatMessages));
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        // Сохраняем локально
        if (sheetName === 'Заявки') {
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
        } else if (sheetName === 'Праздники') {
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
        } else if (sheetName === 'Чат') {
            localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatMessages));
        }
        return false;
    }
}

// Проверка новых данных
async function checkForNewData() {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?sheet=Заявки&t=${Date.now()}`);
        const data = await response.json();
        
        if (data && data.data && data.data.length > applications.length) {
            // Есть новые заявки!
            playNotificationSound();
            showAlert('📢 Новая заявка!', 'success');
            
            applications = data.data;
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
            
            if (document.getElementById('adminTab').classList.contains('active')) {
                renderApplications();
            }
        }
    } catch (error) {
        console.error('Ошибка проверки новых данных:', error);
    }
}

// Настройка обработчиков
function setupEventListeners() {
    // Секретный вход (15 кликов)
    document.getElementById('holidayBanner').addEventListener('click', function() {
        clickCount++;
        console.log('Кликов:', clickCount);
        
        if (clickTimer) clearTimeout(clickTimer);
        
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 3000);
        
        if (clickCount >= 15) {
            console.log('🎉 15 кликов! Показываем форму входа');
            clickCount = 0;
            document.getElementById('loginModal').style.display = 'flex';
        }
    });
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', function() {
        isAdmin = false;
        localStorage.removeItem(STORAGE_KEYS.AUTH);
        updateAdminUI();
        showAlert('Вы вышли из админ-панели', 'success');
    });
    
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'adminTab') {
                renderApplications();
                renderHolidays();
            } else if (tabId === 'statsTab') {
                renderStatistics();
            } else if (tabId === 'vacanciesTab') {
                renderAdminVacancies();
            }
        });
    });
    
    // Отправка заявки
    document.getElementById('applicationForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const newApp = {
            timestamp: new Date().toISOString(),
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            position: document.getElementById('position').value,
            salary: document.getElementById('salary').value,
            status: 'новая',
            notes: '',
            rating: ''
        };
        
        applications.unshift(newApp);
        
        // Сохраняем в Google Sheets
        const sheetData = [
            newApp.timestamp,
            newApp.fullName,
            newApp.email,
            newApp.phone,
            newApp.position,
            newApp.salary,
            newApp.status,
            newApp.notes,
            newApp.rating
        ];
        
        await saveToSheet('Заявки', sheetData);
        
        // Очищаем форму
        document.getElementById('fullName').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('position').value = '';
        document.getElementById('salary').value = '';
        
        showAlert('✅ Спасибо! Заявка отправлена!', 'success');
        playNotificationSound();
        
        // Сохраняем email для проверки статуса
        localStorage.setItem('userEmail', newApp.email);
        localStorage.setItem('lastAppTime', Date.now().toString());
        
        if (isAdmin) {
            renderApplications();
        }
    });
    
    // Добавление праздника
    document.getElementById('addHolidayBtn').addEventListener('click', async function() {
        const name = document.getElementById('holidayName').value.trim();
        const date = document.getElementById('holidayDate').value;
        
        if (!name || !date) {
            showHolidayAlert('Заполните все поля', 'error');
            return;
        }
        
        const newHoliday = {
            id: Date.now().toString(),
            name: name,
            date: date,
            createdAt: new Date().toISOString()
        };
        
        holidays.push(newHoliday);
        
        const sheetData = [
            newHoliday.id,
            newHoliday.name,
            newHoliday.date,
            newHoliday.createdAt
        ];
        
        await saveToSheet('Праздники', sheetData);
        
        document.getElementById('holidayName').value = '';
        document.getElementById('holidayDate').value = '';
        
        renderHolidays();
        updateHolidayBanner();
        showHolidayAlert('✅ Праздник добавлен!', 'success');
    });
    
    // Добавление вакансии
    document.getElementById('addVacancyBtn').addEventListener('click', function() {
        const title = document.getElementById('vacancyTitle').value.trim();
        const desc = document.getElementById('vacancyDesc').value.trim();
        const min = document.getElementById('vacancySalaryMin').value;
        const max = document.getElementById('vacancySalaryMax').value;
        
        if (!title || !desc || !min || !max) {
            showAlert('Заполните все поля', 'error');
            return;
        }
        
        const newVacancy = {
            id: Date.now().toString(),
            title: title,
            description: desc,
            salaryMin: parseInt(min),
            salaryMax: parseInt(max)
        };
        
        vacancies.push(newVacancy);
        localStorage.setItem(STORAGE_KEYS.VACANCIES, JSON.stringify(vacancies));
        
        document.getElementById('vacancyTitle').value = '';
        document.getElementById('vacancyDesc').value = '';
        document.getElementById('vacancySalaryMin').value = '';
        document.getElementById('vacancySalaryMax').value = '';
        
        renderAdminVacancies();
        renderPublicVacancies();
        showAlert('✅ Вакансия добавлена', 'success');
    });
}

// Звук уведомления
function playNotificationSound() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Аудио не поддерживается');
    }
}

// Обработка входа
window.handleLogin = function() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (email === 'admin@admin' && password === 'admin@admin') {
        console.log('✅ Успешный вход!');
        
        isAdmin = true;
        localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
        
        closeLoginModal();
        updateAdminUI();
        showAlert('🔓 Добро пожаловать, администратор!', 'success');
        showEasterEgg();
        
        // Запускаем проверку новых данных
        setInterval(checkForNewData, 10000);
    } else {
        alert('❌ Неверный email или пароль');
    }
};

// Закрыть модальное окно входа
window.closeLoginModal = function() {
    document.getElementById('loginModal').style.display = 'none';
};

// Закрыть модальное окно удаления
window.closeDeleteModal = function() {
    document.getElementById('deleteConfirmModal').style.display = 'none';
    deleteTarget = null;
};

// Подтверждение удаления
window.confirmDelete = async function() {
    if (deleteTarget) {
        holidays = holidays.filter(h => h.id !== deleteTarget);
        
        // Удаляем из таблицы (отправляем специальный маркер)
        await saveToSheet('Праздники', ['DELETE', deleteTarget]);
        
        renderHolidays();
        updateHolidayBanner();
        closeDeleteModal();
        showHolidayAlert('Праздник удален', 'success');
    }
};

// Показать подтверждение удаления
window.showDeleteConfirm = function(id, name) {
    document.getElementById('deleteHolidayName').textContent = name;
    document.getElementById('deleteConfirmModal').style.display = 'flex';
    deleteTarget = id;
};

// Пасхалка
function showEasterEgg() {
    const egg = document.createElement('div');
    egg.innerHTML = '🍖 АДМИН "ОСКОЛКИ" 👑';
    egg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #c43a3a, #e67e22);
        color: white;
        padding: 30px 50px;
        border-radius: 50px;
        font-size: 2rem;
        font-weight: 800;
        z-index: 10000;
        box-shadow: 0 0 100px rgba(196,58,58,0.8);
        animation: bounce 0.5s ease;
        text-align: center;
    `;
    document.body.appendChild(egg);
    
    setTimeout(() => egg.remove(), 3000);
}

// Уведомления
function showAlert(message, type) {
    const alert = document.getElementById('formAlert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert ${type}`;
        alert.style.display = 'flex';
        setTimeout(() => alert.style.display = 'none', 5000);
    }
}

function showHolidayAlert(message, type) {
    const alert = document.getElementById('holidayAlert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert ${type}`;
        alert.style.display = 'flex';
        setTimeout(() => alert.style.display = 'none', 3000);
    }
}

// Обновление интерфейса админа
function updateAdminUI() {
    const adminTabs = document.getElementById('adminTabs');
    const formTab = document.getElementById('formTab');
    const adminTab = document.getElementById('adminTab');
    
    if (!adminTabs || !formTab || !adminTab) return;
    
    if (isAdmin) {
        adminTabs.style.display = 'flex';
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === 'adminTab') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        formTab.classList.remove('active');
        adminTab.classList.add('active');
        
        renderApplications();
        renderHolidays();
        renderStatistics();
    } else {
        adminTabs.style.display = 'none';
        formTab.classList.add('active');
        adminTab.classList.remove('active');
    }
}

// Обновление баннера с праздником
function updateHolidayBanner() {
    const today = new Date().toISOString().split('T')[0];
    const todayHolidays = holidays.filter(h => h.date === today);
    const banner = document.getElementById('holidayBanner');
    const holidayText = document.getElementById('holidayText');
    
    if (todayHolidays.length > 0) {
        const names = todayHolidays.map(h => h.name).join(', ');
        holidayText.textContent = `🎉 Праздник сегодня: ${names}`;
        banner.style.background = 'linear-gradient(135deg, rgba(243,156,18,0.2), rgba(231,76,60,0.2))';
    } else {
        // Проверяем ближайший праздник
        const upcoming = holidays
            .filter(h => h.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))[0];
        
        if (upcoming) {
            const daysUntil = Math.ceil((new Date(upcoming.date) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil === 1) {
                holidayText.textContent = `📅 Завтра: ${upcoming.name}`;
            } else if (daysUntil <= 7) {
                holidayText.textContent = `📅 Через ${daysUntil} дн: ${upcoming.name}`;
            } else {
                const date = new Date(upcoming.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                holidayText.textContent = `📅 ${upcoming.name} (${date})`;
            }
        } else {
            holidayText.textContent = '📅 Рабочие будни';
        }
        banner.style.background = '';
    }
}

// Отрисовка заявок
function renderApplications() {
    const tbody = document.getElementById('applicationsList');
    if (!tbody) return;
    
    if (applications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-message">Пока нет заявок</td></tr>';
        return;
    }
    
    tbody.innerHTML = applications.map(app => {
        const date = new Date(app.timestamp).toLocaleString('ru-RU');
        
        return `
            <tr>
                <td>${date}</td>
                <td>${app.fullName || ''}</td>
                <td>${app.email || ''}</td>
                <td>${app.phone || ''}</td>
                <td>${app.position || ''}</td>
                <td>${app.salary || ''} ₽</td>
                <td>
                    <select onchange="updateStatus('${app.timestamp}', this.value)" class="status-select ${app.status || 'новая'}">
                        <option value="новая" ${app.status === 'новая' ? 'selected' : ''}>🆕 Новая</option>
                        <option value="просмотрено" ${app.status === 'просмотрено' ? 'selected' : ''}>👀 Просмотрено</option>
                        <option value="одобрено" ${app.status === 'одобрено' ? 'selected' : ''}>✅ Одобрено</option>
                        <option value="отказ" ${app.status === 'отказ' ? 'selected' : ''}>❌ Отказ</option>
                    </select>
                </td>
                <td>
                    <input type="text" value="${app.notes || ''}" placeholder="Заметки" 
                           onchange="addNote('${app.timestamp}', this.value)" class="notes-input">
                </td>
                <td>
                    <select onchange="addRating('${app.timestamp}', this.value)" class="rating-select">
                        <option value="">★</option>
                        <option value="1" ${app.rating === '1' ? 'selected' : ''}>★☆☆</option>
                        <option value="2" ${app.rating === '2' ? 'selected' : ''}>★★☆</option>
                        <option value="3" ${app.rating === '3' ? 'selected' : ''}>★★★</option>
                    </select>
                </td>
                <td>
                    <button class="btn-chat" onclick="openChat('${app.timestamp}', '${app.fullName || ''}')">
                        💬
                        ${chatMessages[app.timestamp] ? 
                          `<span class="chat-badge">${chatMessages[app.timestamp].filter(m => m.sender === 'user').length}</span>` 
                          : ''}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Обновляем счетчик новых заявок
    const newApps = applications.filter(a => a.status === 'новая').length;
    const badge = document.getElementById('newAppsBadge');
    if (badge) {
        if (newApps > 0) {
            badge.textContent = newApps;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Отрисовка праздников
function renderHolidays() {
    const container = document.getElementById('holidaysContainer');
    const today = new Date().toISOString().split('T')[0];
    
    if (!container) return;
    
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-message">Нет запланированных праздников</p>';
        return;
    }
    
    container.innerHTML = sorted.map(holiday => {
        const isToday = holiday.date === today;
        const dateObj = new Date(holiday.date);
        const formattedDate = dateObj.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        return `
            <div class="holiday-item ${isToday ? 'today' : ''}">
                <div class="holiday-info">
                    <span class="holiday-name">${holiday.name}</span>
                    <span class="holiday-date">
                        <i class="far fa-calendar-alt"></i> ${formattedDate}
                    </span>
                    ${isToday ? '<span class="today-badge">СЕГОДНЯ</span>' : ''}
                </div>
                <button class="delete-holiday" onclick="showDeleteConfirm('${holiday.id}', '${holiday.name}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

// Отрисовка публичных вакансий
function renderPublicVacancies() {
    const container = document.getElementById('publicVacancies');
    if (!container) return;
    
    if (vacancies.length === 0) {
        container.innerHTML = '<p class="empty-message">Скоро появятся новые вакансии</p>';
        return;
    }
    
    container.innerHTML = vacancies.map(vac => `
        <div class="vacancy-card">
            <div class="vacancy-title">${vac.title}</div>
            <div class="vacancy-desc">${vac.description}</div>
            <div class="vacancy-salary">${vac.salaryMin.toLocaleString()} - ${vac.salaryMax.toLocaleString()} ₽</div>
        </div>
    `).join('');
}

// Отрисовка вакансий в админке
function renderAdminVacancies() {
    const container = document.getElementById('adminVacanciesList');
    if (!container) return;
    
    if (vacancies.length === 0) {
        container.innerHTML = '<p class="empty-message">Нет активных вакансий</p>';
        return;
    }
    
    container.innerHTML = vacancies.map(vac => `
        <div class="vacancy-card">
            <div class="vacancy-title">${vac.title}</div>
            <div class="vacancy-desc">${vac.description}</div>
            <div class="vacancy-salary">${vac.salaryMin.toLocaleString()} - ${vac.salaryMax.toLocaleString()} ₽</div>
            <div class="vacancy-actions">
                <button class="btn-danger" onclick="deleteVacancy('${vac.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
}

// Удаление вакансии
window.deleteVacancy = function(id) {
    vacancies = vacancies.filter(v => v.id !== id);
    localStorage.setItem(STORAGE_KEYS.VACANCIES, JSON.stringify(vacancies));
    renderAdminVacancies();
    renderPublicVacancies();
    showAlert('Вакансия удалена', 'success');
};

// Обновление статуса
window.updateStatus = async function(timestamp, newStatus) {
    const appIndex = applications.findIndex(a => a.timestamp === timestamp);
    if (appIndex !== -1) {
        applications[appIndex].status = newStatus;
        
        const app = applications[appIndex];
        await saveToSheet('Заявки', [
            app.timestamp,
            app.fullName,
            app.email,
            app.phone,
            app.position,
            app.salary,
            app.status,
            app.notes,
            app.rating
        ]);
        
        renderApplications();
        
        if (newStatus === 'одобрено') {
            playNotificationSound();
        }
    }
};

// Добавление заметки
window.addNote = async function(timestamp, note) {
    const appIndex = applications.findIndex(a => a.timestamp === timestamp);
    if (appIndex !== -1) {
        applications[appIndex].notes = note;
        
        const app = applications[appIndex];
        await saveToSheet('Заявки', [
            app.timestamp,
            app.fullName,
            app.email,
            app.phone,
            app.position,
            app.salary,
            app.status,
            app.notes,
            app.rating
        ]);
    }
};

// Добавление рейтинга
window.addRating = async function(timestamp, rating) {
    const appIndex = applications.findIndex(a => a.timestamp === timestamp);
    if (appIndex !== -1) {
        applications[appIndex].rating = rating;
        
        const app = applications[appIndex];
        await saveToSheet('Заявки', [
            app.timestamp,
            app.fullName,
            app.email,
            app.phone,
            app.position,
            app.salary,
            app.status,
            app.notes,
            app.rating
        ]);
    }
};

// Открыть чат
window.openChat = function(applicationId, fullName) {
    // Закрываем другие чаты
    document.querySelectorAll('.chat-window').forEach(w => w.remove());
    
    const chatWindow = document.createElement('div');
    chatWindow.className = 'chat-window active';
    chatWindow.id = `chat_${applicationId}`;
    chatWindow.innerHTML = `
        <div class="chat-header">
            <span>Чат с ${fullName}</span>
            <button onclick="closeChat('${applicationId}')">✕</button>
        </div>
        <div class="chat-messages" id="chatMessages_${applicationId}"></div>
        <div class="chat-input">
            <input type="text" id="chatInput_${applicationId}" placeholder="Введите сообщение...">
            <button onclick="sendChatMessage('${applicationId}')">➤</button>
        </div>
    `;
    
    document.body.appendChild(chatWindow);
    renderChat(applicationId);
};

// Закрыть чат
window.closeChat = function(applicationId) {
    const chatWindow = document.getElementById(`chat_${applicationId}`);
    if (chatWindow) {
        chatWindow.remove();
    }
};

// Отправка сообщения
window.sendChatMessage = async function(applicationId) {
    const input = document.getElementById(`chatInput_${applicationId}`);
    const text = input.value.trim();
    
    if (!text) return;
    
    const newMessage = {
        messageId: Date.now().toString(),
        applicationId: applicationId,
        sender: 'admin',
        text: text,
        timestamp: new Date().toISOString(),
        isRead: false
    };
    
    if (!chatMessages[applicationId]) {
        chatMessages[applicationId] = [];
    }
    chatMessages[applicationId].push(newMessage);
    
    await saveToSheet('Чат', [
        newMessage.messageId,
        newMessage.applicationId,
        newMessage.sender,
        newMessage.text,
        newMessage.timestamp,
        newMessage.isRead
    ]);
    
    input.value = '';
    renderChat(applicationId);
};

// Отрисовка чата
function renderChat(applicationId) {
    const container = document.getElementById(`chatMessages_${applicationId}`);
    if (!container) return;
    
    const messages = chatMessages[applicationId] || [];
    
    container.innerHTML = messages.map(msg => `
        <div class="message ${msg.sender === 'admin' ? 'admin' : 'user'}">
            <div class="message-text">${msg.text}</div>
            <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

// Отрисовка статистики
function renderStatistics() {
    const totalApps = applications.length;
    const newApps = applications.filter(a => a.status === 'новая').length;
    const approvedApps = applications.filter(a => a.status === 'одобрено').length;
    
    const salaries = applications.map(a => parseInt(a.salary)).filter(s => !isNaN(s));
    const avgSalary = salaries.length > 0 
        ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)
        : 0;
    
    document.getElementById('totalApps').textContent = totalApps;
    document.getElementById('newApps').textContent = newApps;
    document.getElementById('approvedApps').textContent = approvedApps;
    document.getElementById('avgSalary').textContent = avgSalary.toLocaleString() + ' ₽';
    
    // Статистика по должностям
    const positions = {};
    applications.forEach(app => {
        if (app.position) {
            positions[app.position] = (positions[app.position] || 0) + 1;
        }
    });
    
    const positionsHtml = Object.entries(positions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pos, count]) => {
            const percent = totalApps > 0 ? (count / totalApps * 100).toFixed(1) : 0;
            const height = Math.min(percent * 2, 150);
            return `
                <div class="bar-container">
                    <div class="bar" style="height: ${height}px"></div>
                    <div class="bar-label">${pos}<br>${count} (${percent}%)</div>
                </div>
            `;
        }).join('');
    
    document.getElementById('positionsChart').innerHTML = positionsHtml || '<p>Нет данных</p>';
    
    // Динамика по дням
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = applications.filter(a => a.timestamp.startsWith(dateStr)).length;
        last7Days.push({ date: dateStr, count });
    }
    
    const maxCount = Math.max(...last7Days.map(d => d.count), 1);
    const timelineHtml = last7Days.map(day => {
        const height = maxCount > 0 ? (day.count / maxCount) * 150 : 0;
        return `
            <div class="bar-container">
                <div class="bar" style="height: ${height}px"></div>
                <div class="bar-label">${day.date.slice(5)}<br>${day.count}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('timelineChart').innerHTML = timelineHtml || '<p>Нет данных</p>';
}
