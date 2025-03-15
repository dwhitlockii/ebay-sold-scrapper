// Developer: Dean Whitlock

// Password strength validation
function checkPasswordStrength(password) {
  let strength = 0;
  const strengthBar = document.getElementById('passwordStrength');
  
  // Length check
  if (password.length >= 8) strength++;
  
  // Contains lowercase letter
  if (/[a-z]/.test(password)) strength++;
  
  // Contains uppercase letter
  if (/[A-Z]/.test(password)) strength++;
  
  // Contains number
  if (/[0-9]/.test(password)) strength++;
  
  // Contains special character
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  // Update strength bar
  strengthBar.className = 'password-strength';
  if (strength <= 2) {
    strengthBar.classList.add('strength-weak');
  } else if (strength <= 4) {
    strengthBar.classList.add('strength-medium');
  } else {
    strengthBar.classList.add('strength-strong');
  }
  
  return strength;
}

// Password toggle visibility
document.getElementById('togglePassword').addEventListener('click', function() {
  const passwordInput = document.getElementById('password');
  const icon = this.querySelector('i');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
});

// Password strength check on input
document.getElementById('password').addEventListener('input', function() {
  checkPasswordStrength(this.value);
});

// Form submission
document.getElementById('registerForm').addEventListener('submit', function(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  const termsCheck = document.getElementById('termsCheck').checked;
  
  // Basic validation
  if (!termsCheck) {
    const registerError = document.getElementById('registerError');
    registerError.textContent = 'Please accept the Terms and Conditions';
    registerError.style.display = 'block';
    return;
  }
  
  if (password !== confirmPassword) {
    const registerError = document.getElementById('registerError');
    registerError.textContent = 'Passwords do not match';
    registerError.style.display = 'block';
    return;
  }
  
  // Password strength validation
  if (checkPasswordStrength(password) < 3) {
    const registerError = document.getElementById('registerError');
    registerError.textContent = 'Password is too weak. Please make it stronger.';
    registerError.style.display = 'block';
    return;
  }
  
  fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      username, 
      email, 
      password,
      firstName,
      lastName,
      confirmPassword
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Show success message
      const successMessage = document.getElementById('successMessage');
      successMessage.textContent = data.message;
      successMessage.style.display = 'block';
      
      // Hide any error messages
      const registerError = document.getElementById('registerError');
      registerError.style.display = 'none';
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
    } else {
      const registerError = document.getElementById('registerError');
      if (data.errors) {
        // Handle validation errors
        const errorMessages = Object.values(data.errors).join('\n');
        registerError.textContent = errorMessages;
      } else {
        registerError.textContent = data.error || 'Registration failed. Please try again.';
      }
      registerError.style.display = 'block';
      
      // Hide success message if it was shown
      const successMessage = document.getElementById('successMessage');
      successMessage.style.display = 'none';
    }
  })
  .catch(error => {
    console.error('Registration error:', error);
    const registerError = document.getElementById('registerError');
    registerError.textContent = 'An error occurred during registration. Please try again.';
    registerError.style.display = 'block';
    
    // Hide success message if it was shown
    const successMessage = document.getElementById('successMessage');
    successMessage.style.display = 'none';
  });
});
