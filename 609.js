const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const path = require('path');

const config = {
    user: 'sa',
    password: '123456789',
    server: 'localhost', 
    database: 'UserDB',
    options: {
        encrypt: false, 
        enableArithAbort: true
    }
};

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));



// Route để hiển thị trang đăng nhập
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'programs/display/login.html'));
});
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/build', express.static(path.join(__dirname, 'build')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/test', express.static(path.join(__dirname, 'test')));

// Serve login.html on logout
app.get('/login.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'programs/display/login.html'));
});



// Xử lý POST từ form đăng nhập
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Kết nối với SQL Server
        await sql.connect(config);
        
        // Truy vấn kiểm tra email và mật khẩu
        const request = new sql.Request();
        request.input('email', sql.VarChar, email);
        request.input('password', sql.VarChar, password);

        const result = await request.query('SELECT * FROM Users WHERE email = @email AND password = @password');
        
        if (result.recordset.length > 0) {
            // Đăng nhập thành công -> chuyển hướng đến trang index.html trong thư mục programs/display
            res.sendFile(path.resolve(__dirname, 'programs/display/index.html'));
        } else {
            res.send('<h1>Login failed</h1><p>Invalid email or password.</p>');
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});

// Khởi chạy server
const port = process.env.PORT || 6009;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
