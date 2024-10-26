const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const usersDir = path.join(__dirname, 'users');
const ipLogPath = path.join(__dirname, 'ip_log.txt');
const blockedIPsPath = path.join(__dirname, 'blocked_ips.json');

// Проверка существования папки пользователей
if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir);
}

// Проверка существования файла заблокированных IP
if (!fs.existsSync(blockedIPsPath)) {
    fs.writeFileSync(blockedIPsPath, JSON.stringify([]));
}

// Проверка существования пользователя
function userExists(username) {
    return fs.existsSync(path.join(usersDir, `${username}.json`));
}

// Логирование IP-адреса
function logIP(ip) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${ip}\n`;
    fs.appendFileSync(ipLogPath, logEntry);
}

// Проверка, заблокирован ли IP-адрес
function isIPBlocked(ip) {
    const blockedIPs = JSON.parse(fs.readFileSync(blockedIPsPath));
    return blockedIPs.includes(ip);
}

// Функция для блокировки IP
app.post('/block-ip', (req, res) => {
    const adminUsername = req.body.adminUsername;
    const ipToBlock = req.body.ip;

    // Только администраторы могут блокировать IP
    if (!userExists(adminUsername)) {
        return res.status(403).send('Доступ запрещен');
    }

    const adminData = JSON.parse(fs.readFileSync(path.join(usersDir, `${adminUsername}.json`)));
    if (adminData.role !== 'admin' && adminData.username !== 'drenote') {
        return res.status(403).send('Только администратор может блокировать IP');
    }

    const blockedIPs = JSON.parse(fs.readFileSync(blockedIPsPath));

    if (!blockedIPs.includes(ipToBlock)) {
        blockedIPs.push(ipToBlock);
        fs.writeFileSync(blockedIPsPath, JSON.stringify(blockedIPs, null, 2));
        res.send(`IP ${ipToBlock} заблокирован.`);
    } else {
        res.status(400).send('Этот IP уже заблокирован.');
    }
});

// Применение блокировки IP
app.use((req, res, next) => {
    const userIP = req.ip;

    // Логируем IP пользователя
    logIP(userIP);

    // Проверяем, заблокирован ли IP
    if (isIPBlocked(userIP)) {
        return res.status(403).send('Ваш IP заблокирован.');
    }

    next();
});

// Получение списка всех пользователей
app.get('/users', (req, res) => {
    fs.readdir(usersDir, (err, files) => {
        if (err) {
            return res.status(500).send('Ошибка при получении пользователей');
        }
        const users = files.map(file => file.replace('.json', ''));
        res.json(users);
    });
});

// Назначение администратора
app.post('/users/:username/admin', (req, res) => {
    const username = req.params.username;
    const filePath = path.join(usersDir, `${username}.json`);

    if (userExists(username)) {
        const userData = JSON.parse(fs.readFileSync(filePath));
        userData.role = 'admin';
        fs.writeFileSync(filePath, JSON.stringify(userData));
        res.send('Пользователь назначен администратором');
    } else {
        res.status(404).send('Пользователь не найден');
    }
});

// Выдача монет пользователю
app.post('/users/:username/coins', (req, res) => {
    const username = req.params.username;
    const { coins } = req.body;
    const filePath = path.join(usersDir, `${username}.json`);

    if (userExists(username)) {
        const userData = JSON.parse(fs.readFileSync(filePath));
        userData.coins += coins;
        fs.writeFileSync(filePath, JSON.stringify(userData));
        res.send('Монеты выданы');
    } else {
        res.status(404).send('Пользователь не найден');
    }
});

// Изменение роли пользователя (доступно только для drenote)
app.post('/users/:username/role', (req, res) => {
    const adminUsername = req.body.adminUsername;
    const username = req.params.username;
    const newRole = req.body.role;
    const filePath = path.join(usersDir, `${username}.json`);

    if (!userExists(adminUsername) || !userExists(username)) {
        return res.status(404).send('Пользователь не найден');
    }

    const adminData = JSON.parse(fs.readFileSync(path.join(usersDir, `${adminUsername}.json`)));
    if (adminData.username !== 'drenote') {
        return res.status(403).send('Только drenote может изменять роли пользователей');
    }

    const userData = JSON.parse(fs.readFileSync(filePath));
    userData.role = newRole;
    fs.writeFileSync(filePath, JSON.stringify(userData));
    res.send(`Роль пользователя ${username} изменена на ${newRole}`);
});

// Запуск сервера
app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});