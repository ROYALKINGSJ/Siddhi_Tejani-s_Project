// js/auth.js

let isLogin = true;

function toggleForm() {
    isLogin = !isLogin;
    document.getElementById('form-title').innerText = isLogin ? "Login" : "Register";
    document.getElementById('auth-btn').innerText = isLogin ? "Login" : "Register";
    document.getElementById('role-select').style.display = isLogin ? "none" : "block";
    
    const toggleText = isLogin ? "Don't have an account? Register here" : "Already have an account? Login here";
    document.querySelector('.toggle-text').innerHTML = `<b>${toggleText}</b>`;
}

function handleAuth() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (isLogin) {
        // LOGIN
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Fetch user role from database
                db.collection("users").doc(userCredential.user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const role = doc.data().role;
                        if(role === 'admin') window.location.href = "admin-dashboard.html";
                        else window.location.href = "student-dashboard.html";
                    }
                });
            })
            .catch((error) => alert(error.message));
    } else {
        // REGISTER
        const role = document.getElementById('role-select').value;
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Save user role to Firestore Database
                db.collection("users").doc(userCredential.user.uid).set({
                    email: email,
                    role: role
                }).then(() => {
                    alert("Registration Successful!");
                    if(role === 'admin') window.location.href = "admin-dashboard.html";
                    else window.location.href = "student-dashboard.html";
                });
            })
            .catch((error) => alert(error.message));
    }
}