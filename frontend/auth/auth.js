// Utility function for API calls
async function apiCall(url, method, body) {
    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        return { success: response.ok, result };
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, result: { message: 'Network error. Please try again later.' } };
    }
}

// Sign Up Form Submission
document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone').value;

    // Validate phone format (optional)
    if (phone && !/^\d{10,15}$/.test(phone)) {
        alert('Invalid phone number. Please enter a valid number.');
        return;
    }

    const { success, result } = await apiCall("http://127.0.0.1:5000/signup", 'POST', { name, email, password, phone });

    if (success) {
        alert('Sign Up Successful!');
        window.location.href = 'signin.html'; // Redirect to Sign In page
    } else {
        alert(result.message);
    }
});

// Sign In Form Submission
document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { success, result } = await apiCall("http://127.0.0.1:5000/signin", 'POST', { email, password });

    if (success) {
        alert('Sign In Successful!');
        localStorage.setItem('user', JSON.stringify({
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            phone: result.user.phone || null // Store phone if provided
        }));

        // Redirect based on role
        if (result.user.role === 'admin') {
            window.location.href = '../admin/admin.html'; // Redirect to admin page
        } else {
            window.location.href = '../index.html'; // Redirect to main page
        }
    } else {
        alert(result.message);
    }
});

// Account Button Logic
document.getElementById('account')?.addEventListener('click', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        const phone = user.phone ? user.phone : 'Not provided';
        alert(`Name: ${user.name}\nEmail: ${user.email}\nPhone: ${phone}`);
    } else {
        alert('No user information found. Please sign in.');
    }
});