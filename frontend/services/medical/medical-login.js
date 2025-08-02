document.getElementById('medical-login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('medical-email').value.trim();
  const password = document.getElementById('medical-password').value;

  const errorDiv = document.getElementById('medical-login-error');
  errorDiv.textContent = '';

  try {
    const response = await fetch('http://localhost:5000/api/medical/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (response.ok && result.status === 'success') {
      // Store the token in localStorage
      localStorage.setItem('medicalServiceEmail', email);
      // Redirect to medical dashboard
      window.location.href = 'medical.html';
    } else {
      errorDiv.textContent = result.message || 'Invalid email or password.';
    }
  } catch (err) {
    errorDiv.textContent = 'Network error. Please try again.';
  }
});