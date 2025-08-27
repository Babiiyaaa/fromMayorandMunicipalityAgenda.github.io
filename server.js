const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

const conn = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'booking_db'
});

// ให้ / เด้งไป index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// โหลดไฟล์ static (CSS, JS, รูปภาพ)
app.use(express.static('public'));

app.post('/index', (req, res) => {
  const { username, password, email } = req.body;
  conn.query('SELECT * FROM users WHERE username=?', [username], (err, rows) => {
    if (err) return res.json({ success: false });
    if (rows.length > 0) return res.json({ success: false, message: 'ชื่อซ้ำ' });

    conn.query(
      'INSERT INTO users (username,password,role,email) VALUES (?,?, "user", ?)',
      [username, password, email],
      (err2) => err2 ? res.json({ success: false }) : res.json({ success: true, redirect: '/login.html' })
    );
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  conn.query('SELECT * FROM users WHERE username=? AND password=?', [username, password], (err, rows) => {
    if (err || rows.length === 0) return res.json({ success: false });
    const u = rows[0];
    req.session.user = { username: u.username, role: u.role };
    res.json({ success: true, redirect: u.role === 'admin' ? '/admin.html' : '/index1.html' });
  });
});

app.post('/book', (req, res) => {
  const { name, type, date, time, end_time, purpose, equipment } = req.body;
  conn.query(
    'INSERT INTO bookings (name,type,date,time,end_time,purpose,equipment) VALUES (?,?,?,?,?,?,?)',
    [name, type, date, time, end_time, purpose, equipment],
    (err) => err ? res.send('Error') : res.send('บันทึกเรียบร้อย')
  );
});

app.get('/bookings', (req, res) => {
  conn.query('SELECT * FROM bookings', (err, rows) => res.json(rows || []));
});

app.get('/approved-bookings', (req, res) => {
  conn.query('SELECT * FROM bookings WHERE status="approved"', (err, rows) => res.json(rows || []));
});

app.post('/approve', (req, res) => {
  conn.query('UPDATE bookings SET status="approved" WHERE id=?', [req.body.id], err =>
    err ? res.send('Error') : res.send('Approved'));
});

app.post('/reject', (req, res) => {
  conn.query('UPDATE bookings SET status="rejected" WHERE id=?', [req.body.id], err =>
    err ? res.send('Error') : res.send('Rejected'));
});

app.post('/cancel', (req, res) => {
  conn.query('DELETE FROM bookings WHERE id=?', [req.body.id], err =>
    err ? res.send('Error') : res.send('Cancelled'));
});

app.get('/export/excel', (req, res) => {
  conn.query('SELECT * FROM bookings', async (err, rows) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bookings');
    ws.columns = [
      { header: 'ชื่อ', key: 'name' },
      { header: 'ประเภท', key: 'type' },
      { header: 'วันที่', key: 'date' },
      { header: 'เวลาเริ่ม', key: 'time' },
      { header: 'สิ้นสุด', key: 'end_time' },
      { header: 'วัตถุประสงค์', key: 'purpose' },
      { header: 'อุปกรณ์', key: 'equipment' },
      { header: 'สถานะ', key: 'status' }
    ];
    rows.forEach(r => ws.addRow(r));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings.xlsx');
    await wb.xlsx.write(res);
    res.end();
  });
});

app.listen(port, () => console.log(`✅ Running at http://localhost:${port}`));
