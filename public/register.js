// Developer: Dean Whitlock

document.getElementById('registerForm').addEventListener('submit', function(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  
  fetch('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, email, password })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      window.location.href = '/login.html';
    } else {
      const registerError = document.getElementById('registerError');
      registerError.textContent = data.error;
      registerError.style.display = 'block';
    }
  })
  .catch(error => {
    console.error('Error during registration:', error);
    const registerError = document.getElementById('registerError');
    registerError.textContent = 'An error occurred during registration.';
    registerError.style.display = 'block';
  });
});
