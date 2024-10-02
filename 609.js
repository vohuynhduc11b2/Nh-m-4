const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const path = require('path');
const session = require('express-session');

const app = express(); // Khởi tạo ứng dụng express

app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

// Thiết lập middleware cho session
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set true if using HTTPS
}));


const config = {
    user: 'sa',
    password: '123456789',
    server: 'localhost', 
    database: 'UserDD',
    options: {
        encrypt: false, 
        enableArithAbort: true
    }
};

// Hàm lấy thời gian hiện tại theo múi giờ của hệ thống và định dạng theo "YYYY-MM-DD HH:mm:ss.SSS"
function getCurrentDateTime() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    const milliseconds = String(currentDate.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}
app.get('/index.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'programs/display/index.html'));
});
// Serve login.html on logout
app.get('/login.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'programs/display/login.html'));
});
// Route để hiển thị trang đăng nhập
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'programs/display/login.html'));
});

// Route để hiển thị trang admin
app.get('/admin.html', (req, res) => {
    if (req.session.role === 'admin') {
        res.sendFile(path.resolve(__dirname, 'programs/display/admin.html'));
    } else {
        res.status(403).send('Access denied.');
    }
});


// Xử lý POST từ form đăng nhập
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('email', sql.VarChar, email);
        request.input('password', sql.VarChar, password);

        const result = await request.query('SELECT * FROM Users WHERE email = @email AND password = @password');
        
        if (result.recordset.length > 0) {
            req.session.email = email;
            req.session.role = result.recordset[0].role;

            const currentTime = getCurrentDateTime(); 
            const updateRequest = new sql.Request();
            updateRequest.input('email', sql.VarChar, email);
            updateRequest.input('last_login_time', sql.VarChar, currentTime);
            await updateRequest.query('UPDATE Users SET last_login_time = @last_login_time WHERE email = @email');
            
            if (req.session.role === 'admin') {
                res.sendFile(path.resolve(__dirname, 'programs/display/admin.html'));
            } else {
                res.sendFile(path.resolve(__dirname, 'programs/display/index.html'));
            }
        } else {
            res.send('<h1>Login failed</h1><p>Invalid email or password.</p>');
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});

// Route để lấy thông tin người dùng
app.get('/api/user', async (req, res) => {
    const email = req.session.email;

    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('email', sql.VarChar, email);
        
        const result = await request.query('SELECT email, last_login_time FROM Users WHERE email = @email');

        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});

// Route để lấy danh sách người dùng
app.get('/api/users', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT email, password, last_login_time, role FROM Users');
        res.json(result.recordset);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});

// Route để thêm người dùng
app.post('/api/users', async (req, res) => {
    const { email, password, role } = req.body;
    
    // Kiểm tra các trường bắt buộc
    if (!email || !password || !role) {
        return res.status(400).send('Missing required fields');
    }
    if (!email.endsWith('@gmail.com')) {
        return res.status(400).send('Email must end with @gmail.com');
    }

    // Kiểm tra độ dài mật khẩu
    if (password.length < 6) {
        return res.status(400).send('Password must be at least 6 characters long');
    }

    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('email', sql.VarChar, email);
        request.input('password', sql.VarChar, password);
        request.input('role', sql.VarChar, role);

        await request.query('INSERT INTO Users (email, password, role) VALUES (@email, @password, @role)');
        res.status(201).send('User added successfully');
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});

// Route để xóa người dùng
app.delete('/api/users/:email', async (req, res) => {
    const { email } = req.params;
    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('email', sql.VarChar, email);

        await request.query('DELETE FROM Users WHERE email = @email');
        res.send('User deleted successfully');
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});

// Route để cập nhật người dùng
// Route để cập nhật người dùng (bao gồm cả email, mật khẩu và vai trò)
app.put('/api/users/:oldEmail', async (req, res) => {
    const { oldEmail } = req.params;
    const { email, password, role } = req.body;

    // Kiểm tra các trường đầu vào
    if (!email || !password || !role) {
        return res.status(400).send('Missing required fields');
    }
    if (!email.endsWith('@gmail.com')) {
        return res.status(400).send('Email must end with @gmail.com');
    }
    if (password.length < 6) {
        return res.status(400).send('Password must be at least 6 characters long');
    }

    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('oldEmail', sql.VarChar, oldEmail);
        request.input('email', sql.VarChar, email);
        request.input('password', sql.VarChar, password);
        request.input('role', sql.VarChar, role);

        await request.query('UPDATE Users SET email = @email, password = @password, role = @role WHERE email = @oldEmail');
        res.send('User updated successfully');
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});


// Tạo các route để phục vụ tài nguyên tĩnh
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/build', express.static(path.join(__dirname, 'build')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/test', express.static(path.join(__dirname, 'test')));

// Khởi chạy server
const port = process.env.PORT || 6009;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
