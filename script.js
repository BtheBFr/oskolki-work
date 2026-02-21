// Состояние приложения
let isAdmin = false;
let applications = [];
let holidays = [];
let deleteTarget = null;

// Константы для ключей localStorage
const STORAGE_KEYS = {
    APPLICATIONS: 'oskolkiApplications',
    HOLIDAYS: 'oskolkiHolidays',
    AUTH: 'oskolkiAuth'
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем данные
    loadApplications();
    loadHolidays();
    checkAuth();
    updateHolidayBanner();
    
    // Назначаем обработчики
    setupEventListeners();
});

// Загрузка заявок
function loadApplications() {
    const saved = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    if (saved) {
        try {
            applications = JSON.parse(saved);
        } catch (e) {
            applications = [];
        }
    } else {
        // Добавляем тестовые данные, если ничего нет
        applications = [
            {
                id: Date.now() - 86400000,
                fullName: 'Иван Петров',
                email: 'ivan@example.com',
                phone: '+7 (999) 123-45-67',
                position: 'Обвальщик',
                date: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: Date.now() - 172800000,
                fullName: 'Мария Сидорова',
                email: 'maria@example.com',
                phone: '+7 (999) 765-43-21',
                position: 'Технолог',
                date: new Date(Date.now() - 172800000).toISOString()
            }
        ];
        saveApplications();
    }
}

// Сохранение заявок
function saveApplications() {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(applications));
}

// Загрузка праздников
function loadHolidays() {
    const saved = localStorage.getItem(STORAGE_KEYS.HOLIDAYS);
    if (saved) {
        try {
            holidays = JSON.parse(saved);
        } catch (e) {
            holidays = [];
        }
    } else {
        // Добавляем тестовый праздник
        const today = new Date().toISOString().split('T')[0];
        holidays = [
            {
                id: Date.now(),
                name: 'День колбасы',
                date: today
            }
        ];
        saveHolidays();
    }
}

// Сохранение праздников
function saveHolidays() {
    localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
}

// Проверка авторизации
function checkAuth() {
    const auth = localStorage.getItem(STORAGE_KEYS.AUTH);
    isAdmin = auth === 'true';
    updateAdminUI();
}

// Обновление интерфейса в зависимости от статуса админа
function updateAdminUI() {
    const adminTabs = document.getElementById('adminTabs');
    const formTab = document.getElementById('formTab');
    const adminTab = document.getElementById('adminTab');
    
    if (isAdmin) {
        adminTabs.style.display = 'flex';
        // Показываем вкладку админки
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
    } else {
        adminTabs.style.display = 'none';
        formTab.classList.add('active');
        adminTab.classList.remove('active');
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка входа в админку
    document.getElementById('adminLockBtn').addEventListener('click', function() {
        document.getElementById('adminLoginModal').classList.add('active');
    });
    
    // Закрытие модалки входа
    document.getElementById('closeLoginModal').addEventListener('click', function() {
        document.getElementById('adminLoginModal').classList.remove('active');
    });
    
    // Логин
    document.getElementById('loginBtn').addEventListener('click', function() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (email === 'admin@admin' && password === 'admin@admin') {
            isAdmin = true;
            localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
            document.getElementById('adminLoginModal').classList.remove('active');
            updateAdminUI();
            showAlert('Добро пожаловать, администратор!', 'success');
        } else {
            showAlert('Неверный email или пароль', 'error');
        }
    });
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', function() {
        isAdmin = false;
        localStorage.setItem(STORAGE_KEYS.AUTH, 'false');
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
            }
        });
    });
    
    // Отправка формы заявки
    document.getElementById('applicationForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const position = document.getElementById('position').value;
        
        if (!fullName || !email || !phone || !position) {
            showAlert('Пожалуйста, заполните все поля', 'error');
            return;
        }
        
        const newApplication = {
            id: Date.now(),
            fullName,
            email,
            phone,
            position,
            date: new Date().toISOString()
        };
        
        applications.unshift(newApplication);
        saveApplications();
        
        // Очищаем форму
        document.getElementById('fullName').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('position').value = '';
        
        showAlert('Спасибо! Ваша заявка принята. Мы скоро свяжемся с вами.', 'success');
        
        // Если админ открыт, обновляем список
        if (isAdmin) {
            renderApplications();
        }
    });
    
    // Добавление праздника
    document.getElementById('addHolidayBtn').addEventListener('click', function() {
        const name = document.getElementById('holidayName').value.trim();
        const date = document.getElementById('holidayDate').value;
        
        if (!name || !date) {
            showHolidayAlert('Заполните название и дату праздника', 'error');
            return;
        }
        
        // Проверяем, нет ли уже праздника на эту дату
        if (holidays.some(h => h.date === date)) {
            showHolidayAlert('На эту дату уже запланирован праздник', 'error');
            return;
        }
        
        const newHoliday = {
            id: Date.now(),
            name,
            date
        };
        
        holidays.push(newHoliday);
        saveHolidays();
        
        // Очищаем форму
        document.getElementById('holidayName').value = '';
        document.getElementById('holidayDate').value = '';
        
        renderHolidays();
        updateHolidayBanner();
        showHolidayAlert('Праздник добавлен!', 'success');
    });
    
    // Модалка удаления
    document.getElementById('cancelDeleteBtn').addEventListener('click', function() {
        document.getElementById('deleteConfirmModal').classList.remove('active');
        deleteTarget = null;
    });
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        if (deleteTarget) {
            holidays = holidays.filter(h => h.id !== deleteTarget);
            saveHolidays();
            renderHolidays();
            updateHolidayBanner();
            document.getElementById('deleteConfirmModal').classList.remove('active');
            deleteTarget = null;
            showHolidayAlert('Праздник удален', 'success');
        }
    });
    
    // Закрытие модалок по клику вне
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('admin-login-modal')) {
            e.target.classList.remove('active');
        }
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// Показ уведомлений в форме
function showAlert(message, type) {
    const alert = document.getElementById('formAlert');
    alert.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'flex';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Показ уведомлений в планировщике
function showHolidayAlert(message, type) {
    const alert = document.getElementById('holidayAlert');
    alert.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'flex';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 3000);
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
                holidayText.textContent = `📅 Через ${daysUntil} дня: ${upcoming.name}`;
            } else {
                holidayText.textContent = `📅 Ближайший праздник: ${upcoming.name} (${formatDate(upcoming.date)})`;
            }
        } else {
            holidayText.textContent = '📅 Рабочие будни';
        }
        banner.style.background = '';
    }
}

// Форматирование даты
function formatDate(dateString) {
    const options = { day: 'numeric', month: 'long' };
    return new Date(dateString).toLocaleDateString('ru-RU', options);
}

// Отрисовка заявок в админке
function renderApplications() {
    const tbody = document.getElementById('applicationsList');
    
    if (applications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Пока нет ни одной заявки</td></tr>';
        return;
    }
    
    tbody.innerHTML = applications.slice(0, 20).map(app => {
        const date = new Date(app.date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <tr>
                <td>${date}</td>
                <td>${app.fullName}</td>
                <td>${app.email}</td>
                <td>${app.phone}</td>
                <td>${app.position}</td>
            </tr>
        `;
    }).join('');
}

// Отрисовка праздников в админке
function renderHolidays() {
    const container = document.getElementById('holidaysContainer');
    const today = new Date().toISOString().split('T')[0];
    
    // Сортируем по дате
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
                <button class="delete-holiday" onclick="confirmDelete(${holiday.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

// Подтверждение удаления праздника
window.confirmDelete = function(id) {
    const holiday = holidays.find(h => h.id === id);
    if (holiday) {
        document.getElementById('deleteHolidayName').textContent = holiday.name;
        document.getElementById('deleteConfirmModal').classList.add('active');
        deleteTarget = id;
    }
};
