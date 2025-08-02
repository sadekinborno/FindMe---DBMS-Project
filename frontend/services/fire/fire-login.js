document.getElementById('fire-login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('fire-email').value.trim();
  const password = document.getElementById('fire-password').value;

  const errorDiv = document.getElementById('fire-login-error');
  errorDiv.textContent = '';

  try {
    const response = await fetch('http://localhost:5000/api/fire/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (response.ok && result.status === 'success') {
      // Store the token in localStorage
      localStorage.setItem('fireServiceEmail', email);
      // Redirect to fire dashboard
      window.location.href = 'fire.html';
    } else {
      errorDiv.textContent = result.message || 'Invalid email or password.';
    }
  } catch (err) {
    errorDiv.textContent = 'Network error. Please try again.';
  }
});