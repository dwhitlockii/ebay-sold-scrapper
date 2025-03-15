document.addEventListener("DOMContentLoaded", function() {
  console.debug("Login page loaded.");
  
  // Check if already logged in
  if (localStorage.getItem('token') && localStorage.getItem('refreshToken')) {
    window.location.href = '/';
    return;
  }

  // Handle login form submission
  document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginError = document.getElementById('loginError');
    
    if (!username || !password) {
      loginError.textContent = 'Please enter both username and password.';
      loginError.style.display = 'block';
      return;
    }
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store tokens
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        
        // Store user info
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to home page
        window.location.href = '/';
      } else {
        loginError.textContent = data.error || 'Login failed. Please try again.';
        loginError.style.display = 'block';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = 'An error occurred during login. Please try again.';
      loginError.style.display = 'block';
    }
  });

  // Handle forgot password link
  document.getElementById('forgotPassword').addEventListener('click', async function(event) {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    
    if (!email) {
      alert('Please enter your email address first.');
      return;
    }

    try {
      const response = await fetch('/api/reset-password-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (data.success) {
        alert('Password reset instructions have been sent to your email.');
      } else {
        alert(data.error || 'Failed to process password reset request.');
      }
    } catch (error) {
      console.error('Error requesting password reset:', error);
      alert('An error occurred. Please try again.');
    }
  });
});
