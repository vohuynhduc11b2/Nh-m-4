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
    database: 'nhom4', // Đảm bảo tên database chính xác
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

app.get('/api/users/current', async (req, res) => {
    if (req.session.idUser) {
        try {
            await sql.connect(config);
            const request = new sql.Request();
            request.input('IDUser', sql.Char(6), req.session.idUser);
            
            // Truy vấn thông tin người dùng dựa trên IDUser trong session
            const result = await request.query(`
                SELECT IDUser, Ten, SDT, email 
                FROM [Users] 
                WHERE IDUser = @IDUser
            `);
            
            if (result.recordset.length > 0) {
                const user = result.recordset[0];
                res.json({
                    idUser: user.IDUser,
                    tenUser: user.Ten,
                    sdt: user.SDT,
                    email: user.email
                });
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        } catch (err) {
            console.error('Database query error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    } else {
        res.status(401).json({ error: 'User not logged in' });
    }
});


app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            res.status(500).json({ success: false, message: 'Logout failed' });
        } else {
            res.clearCookie('connect.sid'); // Xóa cookie session
            res.json({ success: true, message: 'Logout successful' });
        }
    });
});
//// Route để hiển thị trang user-ìnof

app.get('/user-info.html', (req, res) => {
    if (req.session.idUser) {
        res.sendFile(path.resolve(__dirname, 'programs/display/user-info.html'));
    } else {
        res.redirect('/login.html');
    }
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


app.get('/index.html', (req, res) => {
    if (req.session.role === 'user' || req.session.role === 'admin') {
        res.sendFile(path.resolve(__dirname, 'programs/display/index.html'));
    } else {
        res.status(403).send('Access denied.');
    }
});

app.get('/api/users/role', (req, res) => {
    if (req.session.role) {
        res.json({ role: req.session.role });
    } else {
        res.status(401).json({ error: 'User not logged in' });
    }
});


// Xử lý POST từ form đăng nhập
app.post('/login', async (req, res) => {
    const { idUser, password } = req.body;

    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('idUser', sql.Char(6), idUser);
        request.input('password', sql.VarChar, password);

        const result = await request.query('SELECT * FROM [Users] WHERE IDUser = @idUser AND pass = @password');

        if (result.recordset.length > 0) {
            req.session.idUser = idUser;
            req.session.role = result.recordset[0].Vaitro;

            if (req.session.role === 'admin') {
                res.json({ success: true, redirect: '/admin.html' });
            } else if (req.session.role === 'user') {
                res.json({ success: true, redirect: '/index.html' });
            } else {
                res.json({ success: false, message: 'Access denied: Your role is not authorized.' });
            }
        } else {
            res.json({ success: false, message: 'Đăng nhập không thành công: ID hoặc mật khẩu không hợp lệ.' });
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Route để thêm người dùng
// Route to add a user
app.post('/api/users/add', async (req, res) => {
    const { txtIDUser, txtTenUser, txtSDT, txtEmail, txtPass, txtVaiTro, quyen } = req.body;

    try {
        await sql.connect(config);
        const request = new sql.Request();

        // Check if the ID already exists
        request.input('IDUser', sql.Char(6), txtIDUser);
        const checkIDResult = await request.query('SELECT * FROM [Users] WHERE IDUser = @IDUser');
        if (checkIDResult.recordset.length > 0) {
            res.status(400).send('ID người dùng đã tồn tại trong hệ thống.');
            return;
        }

        // Check if the email already exists
        request.input('email', sql.VarChar(255), txtEmail);
        const checkEmailResult = await request.query('SELECT * FROM [Users] WHERE email = @email');
        if (checkEmailResult.recordset.length > 0) {
            res.status(400).send('Email đã tồn tại trong hệ thống.');
            return;
        }

        // Check if the phone number already exists
        request.input('SDT', sql.VarChar(15), txtSDT);
        const checkPhoneResult = await request.query('SELECT * FROM [Users] WHERE SDT = @SDT');
        if (checkPhoneResult.recordset.length > 0) {
            res.status(400).send('Số điện thoại đã tồn tại trong hệ thống.');
            return;
        }

        // Insert the new user
        request.input('Ten', sql.VarChar(255), txtTenUser);
        request.input('pass', sql.VarChar(255), txtPass);
        request.input('Vaitro', sql.VarChar(5), txtVaiTro);
        request.input('Quyen', sql.VarChar(255), quyen ? quyen.join(',') : '');

        await request.query(`
            INSERT INTO [Users] (IDUser, Ten, SDT, email, pass, Vaitro, Quyen)
            VALUES (@IDUser, @Ten, @SDT, @email, @pass, @Vaitro, @Quyen)
        `);

        res.send('Thêm người dùng thành công');
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});


// Route để sửa người dùng

// Route to update a user
app.post('/api/users/update', async (req, res) => {
    const { txtIDUser, txtTenUser, txtSDT, txtEmail, txtPass, txtVaiTro, quyen } = req.body;

    try {
        await sql.connect(config);
        const request = new sql.Request();

        // Check if the email already exists for another user
        request.input('email', sql.VarChar(255), txtEmail);
        request.input('IDUser', sql.Char(6), txtIDUser);
        const checkEmailResult = await request.query(`
            SELECT * FROM [Users] WHERE email = @email AND IDUser != @IDUser
        `);
        if (checkEmailResult.recordset.length > 0) {
            res.status(400).send('Email đã tồn tại trong hệ thống.');
            return;
        }

        // Check if the phone number already exists for another user
        request.input('SDT', sql.VarChar(15), txtSDT);
        const checkPhoneResult = await request.query(`
            SELECT * FROM [Users] WHERE SDT = @SDT AND IDUser != @IDUser
        `);
        if (checkPhoneResult.recordset.length > 0) {
            res.status(400).send('Số điện thoại đã tồn tại trong hệ thống.');
            return;
        }

        // Update the user information
        request.input('Ten', sql.VarChar(255), txtTenUser);
        request.input('pass', sql.VarChar(255), txtPass);
        request.input('Vaitro', sql.VarChar(5), txtVaiTro);
        request.input('Quyen', sql.VarChar(255), quyen ? quyen.join(',') : '');

        await request.query(`
            UPDATE [Users]
            SET Ten = @Ten, SDT = @SDT, email = @email, pass = @pass, Vaitro = @Vaitro, Quyen = @Quyen
            WHERE IDUser = @IDUser
        `);

        res.send('Sửa người dùng thành công');
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});


// Route để xóa người dùng
app.post('/api/users/delete', async (req, res) => {
    const { txtIDUser } = req.body;

    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('IDUser', sql.Char(6), txtIDUser);

        // Delete from LichSuNhung first
        await request.query('DELETE FROM LichSuNhung WHERE IDUser = @IDUser');

        // Delete from LichSuTach
        await request.query('DELETE FROM LichSuTach WHERE IDUser = @IDUser');
        
        // Optional: Delete from Admin if the user is an admin
        await request.query('DELETE FROM Admin WHERE IDUser = @IDUser');

        // Finally, delete the user from Users
        await request.query('DELETE FROM [Users] WHERE IDUser = @IDUser');

        res.send('Xóa người dùng thành công');
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});


// Route để lấy danh sách người dùng
app.get('/api/users/list', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT IDUser, Ten, SDT, email, pass, Vaitro, Quyen FROM [Users]');

        res.json(result.recordset); // Trả về danh sách người dùng dưới dạng JSON
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});


app.get('/api/users/search/:id', async (req, res) => {
    const id = req.params.id;

    try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input('IDUser', sql.Char(6), id);

        const result = await request.query('SELECT IDUser, Ten, SDT, email, pass, Vaitro, Quyen FROM [Users] WHERE IDUser = @IDUser');
        
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).send('User not found');
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Server error');
    }
});


app.get('/login.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'programs/display/login.html'));
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
