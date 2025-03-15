document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordStrength = document.getElementById('passwordStrength');
    
    // Password visibility toggle
    togglePasswordBtn.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });

    // Password strength checker
    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/\d/)) strength++;
        if (password.match(/[^a-zA-Z\d]/)) strength++;
        
        passwordStrength.className = 'password-strength';
        if (strength === 0) {
            passwordStrength.style.width = '0';
            passwordStrength.style.backgroundColor = '#ff4444';
        } else if (strength <= 2) {
            passwordStrength.classList.add('strength-weak');
        } else if (strength === 3) {
            passwordStrength.classList.add('strength-medium');
        } else {
            passwordStrength.classList.add('strength-strong');
        }
        
        return strength;
    }

    passwordInput.addEventListener('input', function() {
        checkPasswordStrength(this.value);
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset error displays
        const errorElements = document.querySelectorAll('.invalid-feedback');
        errorElements.forEach(el => el.style.display = 'none');
        document.getElementById('registerError').style.display = 'none';

        // Get form values
        const formData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            password: passwordInput.value,
            confirmPassword: confirmPasswordInput.value
        };

        // Validation
        let isValid = true;
        let errors = [];

        // Name validation
        if (formData.firstName.length < 2) {
            errors.push('First name must be at least 2 characters long');
            isValid = false;
        }
        if (formData.lastName.length < 2) {
            errors.push('Last name must be at least 2 characters long');
            isValid = false;
        }

        // Username validation
        if (formData.username.length < 3) {
            errors.push('Username must be at least 3 characters long');
            isValid = false;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            errors.push('Please enter a valid email address');
            isValid = false;
        }

        // Password validation
        if (checkPasswordStrength(formData.password) < 3) {
            errors.push('Password is not strong enough');
            isValid = false;
        }
        if (formData.password !== formData.confirmPassword) {
            errors.push('Passwords do not match');
            isValid = false;
        }

        // Terms checkbox validation
        if (!document.getElementById('termsCheck').checked) {
            errors.push('Please accept the Terms and Conditions');
            isValid = false;
        }

        if (!isValid) {
            const errorDiv = document.getElementById('registerError');
            errorDiv.innerHTML = errors.join('<br>');
            errorDiv.style.display = 'block';
            return;
        }

        // Submit form
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Show success message and redirect
                alert('Registration successful! Please check your email to verify your account.');
                window.location.href = '/login.html';
            } else {
                // Show error message
                const errorDiv = document.getElementById('registerError');
                errorDiv.textContent = data.error || 'Registration failed. Please try again.';
                errorDiv.style.display = 'block';

                // Show specific field errors if any
                if (data.errors) {
                    Object.keys(data.errors).forEach(field => {
                        const errorElement = document.getElementById(`${field}Error`);
                        if (errorElement) {
                            errorElement.textContent = data.errors[field];
                            errorElement.style.display = 'block';
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            const errorDiv = document.getElementById('registerError');
            errorDiv.textContent = 'An error occurred during registration. Please try again.';
            errorDiv.style.display = 'block';
        }
    });
}); 