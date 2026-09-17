// --- INTERAKTIVE DESIGN-THEMEN STEUERUNG ---
const themeSelect = document.getElementById('theme-select');

if (themeSelect) {
    const savedTheme = localStorage.getItem('user-ledger-theme') || 'light';
    themeSelect.value = savedTheme;
    setTheme(savedTheme);

    themeSelect.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        setTheme(selectedTheme);
        localStorage.setItem('user-ledger-theme', selectedTheme);
    });
}

function setTheme(themeName) {
    if (themeName === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', themeName);
    }
}