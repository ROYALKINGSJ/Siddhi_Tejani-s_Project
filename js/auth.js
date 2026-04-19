// js/auth.js

let isLogin = true;

function toggleForm() {
    isLogin = !isLogin;
    document.getElementById('form-title').innerText = isLogin ? "Login" : "Register";
    document.getElementById('auth-btn').innerText = isLogin ? "Login" : "Register";
    
    // Toggle fields only needed for registration
    document.getElementById('role-select').style.display = isLogin ? "none" : "block";
    document.getElementById('name').style.display = isLogin ? "none" : "block";
    
    const toggleText = isLogin ? "Don't have an account? Register here" : "Already have an account? Login here";
    document.querySelector('.toggle-text').innerHTML = `<b>${toggleText}</b>`;
}

async function handleAuth() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (isLogin) {
        // --- LOGIN LOGIC ---
        try {
            const response = await fetch('https://siddhi-tejani-s-project.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Save the JWT token to local storage so the browser remembers we are logged in
                localStorage.setItem('token', data.token);

                // Route to the correct dashboard based on role
                if (data.role === 'admin') window.location.href = "admin-dashboard.html";
                else window.location.href = "student-dashboard.html";
            } else {
                alert(data.error || "Login failed");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Could not connect to the server. Is Node.js running?");
        }

    } else {
        // --- REGISTER LOGIC ---
        const role = document.getElementById('role-select').value;
        const name = document.getElementById('name').value;

        if (!name || !email || !password) {
            alert("Please fill in all fields!");
            return;
        }

        try {
            const response = await fetch('https://siddhi-tejani-s-project.onrender.com/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });

            const data = await response.json();

            if (response.ok) {
                alert("Registration Successful! Please log in.");
                toggleForm(); // Switch the UI back to the login screen automatically
            } else {
                alert(data.error || "Registration failed");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Could not connect to the server.");
        }
    }
}