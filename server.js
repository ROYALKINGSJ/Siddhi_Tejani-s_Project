require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Middleware
app.use(cors()); // Allows your frontend to make requests to this backend
app.use(express.json()); // Allows the server to read JSON data sent from the frontend

// 1. Connect to TiDB Cloud Database (Securely)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    // This 'ssl' object is the missing piece that fixes your error!
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Successfully connected to the local MySQL database!');
});

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'internship_tasks', 
        allowed_formats: ['jpg', 'png', 'pdf', 'docx'],
        resource_type: 'auto' // <--- ADD THIS EXACT LINE
    }
});

const upload = multer({ storage: storage });

// 2. Registration Endpoint
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into MySQL
        const query = 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)';
        db.query(query, [name, email, hashedPassword, role], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Email already in use.' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ message: 'User registered successfully!' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Login Endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Find the user by email
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = results[0];

        // Compare the provided password with the hashed password in the database
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Generate a JWT Token
        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '2h' }
        );

        res.json({ 
            message: 'Login successful', 
            token: token, 
            role: user.role 
        });
    });
});

// --- MIDDLEWARE: Check if user is logged in securely ---
const authenticateToken = (req, res, next) => {
    // Get the token from the request header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user; // Attach the decoded user info (id, role) to the request
        next();
    });
};

// --- 4. POST AN INTERNSHIP (Admin Only) ---
app.post('/api/internships', authenticateToken, (req, res) => {
    // Security check: Make sure they are an admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can post internships.' });
    }

    const { title, language_req, experience_level } = req.body;
    const admin_id = req.user.id; // We get this safely from the verified token!

    const query = 'INSERT INTO internships (admin_id, title, language_req, experience_level) VALUES (?, ?, ?, ?)';
    db.query(query, [admin_id, title, language_req, experience_level], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ message: 'Internship posted successfully!' });
    });
});

// --- 5. GET ALL INTERNSHIPS (For Students to view) ---
app.get('/api/internships', authenticateToken, (req, res) => {
    // Only fetch internships that are 'open'
    const query = 'SELECT id, title, language_req, experience_level, created_at FROM internships WHERE status = "open" ORDER BY created_at DESC';
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

// --- 6. APPLY FOR AN INTERNSHIP (Student Only) ---
app.post('/api/applications', authenticateToken, (req, res) => {
    // Security check: Make sure they are a student
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Only students can apply for internships.' });
    }

    const { internship_id } = req.body;
    const student_id = req.user.id; 

    // Insert the application into the database
    const query = 'INSERT INTO applications (student_id, internship_id, status) VALUES (?, ?, "pending")';
    
    db.query(query, [student_id, internship_id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error. You might have already applied!' });
        }
        res.status(201).json({ message: 'Application submitted successfully!' });
    });
});

// --- 7. GET APPLICATIONS FOR ADMIN ---
app.get('/api/applications/admin', authenticateToken, (req, res) => {
    // Security check
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can view applications.' });
    }

    const admin_id = req.user.id;
    
    // SQL Magic: Join 3 tables to get the Student Name, Job Title, and Application Status
    const query = `
        SELECT a.id as application_id, u.name as student_name, i.title as internship_title, 
               i.language_req, i.experience_level, a.status, a.task_file_url, a.marks, a.feedback
        FROM applications a 
        JOIN users u ON a.student_id = u.id 
        JOIN internships i ON a.internship_id = i.id 
        WHERE i.admin_id = ?
        ORDER BY a.applied_at DESC
    `;

    db.query(query, [admin_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// --- 8. UPDATE APPLICATION STATUS (Accept/Reject) ---
app.put('/api/applications/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update applications.' });
    }

    const { status } = req.body; // Expecting 'accepted' or 'rejected'
    const applicationId = req.params.id;

    const query = 'UPDATE applications SET status = ? WHERE id = ?';
    db.query(query, [status, applicationId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: `Application ${status} successfully.` });
    });
});

// --- 9. UPLOAD TASK FILE (Student Only) ---
app.post('/api/upload-task', authenticateToken, upload.single('taskFile'), (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Only students can upload tasks.' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const fileUrl = req.file.path; // Cloudinary generates this secure URL for us!
    const studentId = req.user.id;

    // We will attach this file to the student's most recently accepted application
    const query = `
        UPDATE applications 
        SET task_file_url = ? 
        WHERE student_id = ? AND status = 'accepted' 
        ORDER BY applied_at DESC LIMIT 1
    `;

    db.query(query, [fileUrl, studentId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'You need an accepted application before uploading a task.' });
        }
        
        res.json({ message: 'File uploaded successfully!', url: fileUrl });
    });
});

// --- 10. EVALUATE SUBMISSION (Admin Only) ---
app.put('/api/evaluate/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can evaluate tasks.' });
    }

    const { marks, feedback } = req.body;
    const applicationId = req.params.id;

    const query = 'UPDATE applications SET marks = ?, feedback = ? WHERE id = ?';
    db.query(query, [marks, feedback, applicationId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Evaluation saved successfully!' });
    });
});

// --- 11. GET STUDENT'S APPLICATIONS (Student Only) ---
app.get('/api/applications/student', authenticateToken, (req, res) => {
    // Security check: Only students can fetch their own history
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Only students can view their applications.' });
    }

    const studentId = req.user.id;

    // Join the applications and internships tables to get the titles and grades
    const query = `
        SELECT a.id, i.title as internship_title, a.status, a.marks, a.feedback 
        FROM applications a
        JOIN internships i ON a.internship_id = i.id
        WHERE a.student_id = ?
        ORDER BY a.applied_at DESC
    `;

    db.query(query, [studentId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});