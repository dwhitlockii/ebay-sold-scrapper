
document.getElementById('rateLimitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const settings = {
        maxRequests: document.getElementById('maxRequests').value,
        windowMs: document.getElementById('windowMs').value * 60 * 1000 // Convert to milliseconds
    };

    try {
        const response = await fetch('/api/settings/ratelimit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            alert('Rate limit settings saved successfully');
        } else {
            alert('Failed to save rate limit settings');
        }
    } catch (error) {
        console.error('Error saving rate limit settings:', error);
        alert('Error saving settings');
    }
});

document.getElementById('proxyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const settings = {
        proxyList: document.getElementById('proxyList').value.split('\n').filter(line => line.trim()),
        rotationStrategy: document.getElementById('proxyRotation').value
    };

    try {
        const response = await fetch('/api/settings/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            alert('Proxy settings saved successfully');
        } else {
            alert('Failed to save proxy settings');
        }
    } catch (error) {
        console.error('Error saving proxy settings:', error);
        alert('Error saving settings');
    }
});

// Load existing settings when page loads
async function loadSettings() {
    try {
        const [rateLimitResponse, proxyResponse] = await Promise.all([
            fetch('/api/settings/ratelimit'),
            fetch('/api/settings/proxy')
        ]);

        if (rateLimitResponse.ok) {
            const rateLimitSettings = await rateLimitResponse.json();
            document.getElementById('maxRequests').value = rateLimitSettings.maxRequests;
            document.getElementById('windowMs').value = rateLimitSettings.windowMs / (60 * 1000);
        }

        if (proxyResponse.ok) {
            const proxySettings = await proxyResponse.json();
            document.getElementById('proxyList').value = proxySettings.proxyList.join('\n');
            document.getElementById('proxyRotation').value = proxySettings.rotationStrategy;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

loadSettings();
