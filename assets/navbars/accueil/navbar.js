document.addEventListener('DOMContentLoaded', () => {
    fetch('/assets/navbars/accueil/navbar.html')
        .then(res => {
            if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
            return res.text();
        })
        .then(html => {
            document.body.insertAdjacentHTML('afterbegin', html);
            initNavbarScroll();
            initMobileMenu();
            updateAuthButtonState();
            window.addEventListener('storage', updateAuthButtonState);
        })
        .catch(err => console.error('Erreur de chargement navbar:', err));

    function initNavbarScroll() {
        const navbar = document.getElementById('main-navbar');
        if (!navbar) return;

        const handleScroll = () => {
            if (window.scrollY > 30) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
    }

    function initMobileMenu() {
        const toggleBtn = document.getElementById('menu-toggle');
        const navMenu = document.getElementById('nav-menu');
        const overlay = document.getElementById('menu-overlay');

        if (!toggleBtn || !navMenu || !overlay) return;

        const toggle = () => {
            toggleBtn.classList.toggle('is-active');
            navMenu.classList.toggle('is-active');
            overlay.classList.toggle('is-active');
            document.body.style.overflow = navMenu.classList.contains('is-active') ? 'hidden' : '';
        };

        toggleBtn.addEventListener('click', toggle);
        overlay.addEventListener('click', toggle);
    }

    function updateAuthButtonState() {
        const guestButtons = document.querySelectorAll('.auth-guest');
        const workspaceButton = document.querySelector('.auth-user');

        if (!workspaceButton) return;

        let isLoggedIn = false;

        try {
            const localUser = localStorage.getItem('fastcraft-user');
            const sessionUser = sessionStorage.getItem('fastcraft-user');
            if (localUser || sessionUser) {
                isLoggedIn = true;
            } else {
                const firebaseKeys = Object.keys(localStorage || {}).filter(key => key.startsWith('firebase:authUser:'));
                isLoggedIn = firebaseKeys.length > 0;
            }
        } catch (err) {
            isLoggedIn = false;
        }

        guestButtons.forEach(btn => btn.classList.toggle('hidden', isLoggedIn));
        workspaceButton.classList.toggle('hidden', !isLoggedIn);
    }
});