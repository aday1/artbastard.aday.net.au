// Fetch latest release version from GitHub.
async function fetchLatestVersion() {
    try {
        const response = await fetch('https://api.github.com/repos/aday1/artbastard.aday.net.au/releases/latest');
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        const versionElement = document.getElementById('latest-version');
        if (versionElement && data.tag_name) {
            versionElement.textContent = data.tag_name;
        }
    } catch (err) {
        // Network failure / offline - the static fallback in HTML is fine.
        console.warn('Could not fetch latest version', err);
    }
}

// Smooth scrolling for anchor links.
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Lazy-load demo videos when their tile scrolls near the viewport. Each
// <video> tile carries data-src; we copy that into a real <source> on demand.
function setupLazyVideos() {
    const videos = document.querySelectorAll('video[data-src]');
    if (!videos.length) {
        return;
    }

    const swap = (video) => {
        const src = video.getAttribute('data-src');
        if (!src || video.dataset.loaded === '1') {
            return;
        }
        const source = document.createElement('source');
        source.src = src;
        source.type = 'video/webm';
        video.appendChild(source);
        video.dataset.loaded = '1';
        video.load();
    };

    if (typeof IntersectionObserver === 'undefined') {
        // Older browsers: just load everything.
        videos.forEach(swap);
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                swap(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '300px 0px' });

    videos.forEach((v) => observer.observe(v));
}

// Subtle navbar darkening on scroll (preserves existing behaviour).
function setupNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) {
        return;
    }
    const onScroll = () => {
        if (window.pageYOffset > 100) {
            navbar.style.background = 'rgba(10, 10, 15, 0.95)';
        } else {
            navbar.style.background = 'rgba(10, 10, 15, 0.8)';
        }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

document.addEventListener('DOMContentLoaded', () => {
    fetchLatestVersion();
    setupSmoothScroll();
    setupLazyVideos();
    setupNavbarScroll();
});
