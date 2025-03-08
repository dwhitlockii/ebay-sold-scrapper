document.addEventListener("DOMContentLoaded", function() {
  console.debug("Login page loaded.");
  
  document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
      if (data.token) {
        localStorage.setItem('token', data.token);
        window.location.href = '/';
      } else {
        const loginError = document.getElementById('loginError');
        loginError.textContent = data.error;
        loginError.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error during login:', error);
      const loginError = document.getElementById('loginError');
      loginError.textContent = 'An error occurred during login.';
      loginError.style.display = 'block';
    });
  });
});
