window.BACKEND_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
)
    ? 'http://localhost:3001'
    : 'https://chatchime.onrender.com';