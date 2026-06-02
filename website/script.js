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

// Lazy-load demo videos when their tile scrolls near the viewport.
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

// Subtle navbar darkening on scroll.
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

function hexToRgb(hex) {
    hex = String(hex || '').replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
        return false;
    }
}

function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function pickRandomIndex(quotes, current) {
    if (quotes.length <= 1) {
        return 0;
    }
    let n = Math.floor(Math.random() * quotes.length);
    if (n === current) {
        n = (n + 1) % quotes.length;
    }
    return n;
}

// Hero ticker: cycles flagship quotes at top of page.
function setupHeroTicker(quotes) {
    const elBox = document.getElementById('hero-ticker');
    const elText = document.getElementById('hero-ticker-text');
    const elAuthor = document.getElementById('hero-ticker-author');
    if (!elBox || !elText || !quotes.length) {
        return;
    }

    const reduceMotion = prefersReducedMotion();
    const flagshipIndices = [1, 5, 9, 15, 22, 30, 41, 50].filter((i) => i < quotes.length);
    const pool = flagshipIndices.length ? flagshipIndices.map((i) => quotes[i]) : quotes.slice(0, 8);
    let idx = 0;

    function paint(i, fade) {
        const q = pool[i];
        const rgb = hexToRgb(q.color || '#ee8833');
        function apply() {
            elText.textContent = q.text;
            elAuthor.textContent = q.author;
            elAuthor.style.color = q.color || '#ee8833';
            elBox.style.borderColor = q.color || '#ee8833';
            elBox.style.boxShadow = `0 0 24px rgba(${rgb}, 0.15)`;
        }
        if (fade && !reduceMotion) {
            elBox.classList.add('dim');
            setTimeout(() => {
                apply();
                elBox.classList.remove('dim');
            }, 400);
        } else {
            apply();
        }
    }

    paint(0, false);
    if (!reduceMotion) {
        setInterval(() => {
            idx = (idx + 1) % pool.length;
            paint(idx, true);
        }, 9000);
    }
}

// Luminary stage rotator + quote wall.
function setupLuminaryQuotes(quotes) {
    const elBox = document.getElementById('luminary-stage');
    const elText = document.getElementById('luminary-quote-text');
    const elAuthor = document.getElementById('luminary-quote-author');
    const elMeta = document.getElementById('luminary-meta');
    const btnNext = document.getElementById('btn-luminary-next');
    const btnRandom = document.getElementById('btn-luminary-random');
    const btnPause = document.getElementById('btn-luminary-pause');
    const wall = document.getElementById('quote-wall');
    const wallCount = document.getElementById('quote-wall-count');

    if (!quotes.length) {
        if (elText) {
            elText.textContent = 'Quote data failed to load.';
        }
        return;
    }

    if (wallCount) {
        wallCount.textContent = String(quotes.length);
    }

    const reduceMotion = prefersReducedMotion();
    let idx = pickRandomIndex(quotes, -1);
    let playing = !reduceMotion;
    let timer = null;
    const intervalMs = reduceMotion ? 0 : 18000;

    function paint(i, fade) {
        const q = quotes[i];
        const rgb = hexToRgb(q.color || '#0066ff');
        function apply() {
            if (elText) {
                elText.textContent = q.text;
            }
            if (elAuthor) {
                elAuthor.textContent = '\u2014 ' + q.author;
                elAuthor.style.color = q.color || '#0066ff';
            }
            if (elBox) {
                elBox.style.borderLeftColor = q.color || '#0066ff';
                elBox.style.background = `rgba(${rgb}, 0.1)`;
                elBox.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.45), 0 0 40px rgba(${rgb}, 0.12)`;
            }
            if (elMeta) {
                elMeta.textContent = 'quote ' + (i + 1) + ' / ' + quotes.length;
            }
        }
        if (fade && !reduceMotion && elBox) {
            elBox.classList.add('dim');
            setTimeout(() => {
                apply();
                elBox.classList.remove('dim');
            }, 420);
        } else {
            apply();
        }
    }

    function schedule() {
        clearInterval(timer);
        if (!playing || intervalMs <= 0) {
            return;
        }
        timer = setInterval(() => {
            idx = (idx + 1) % quotes.length;
            paint(idx, true);
        }, intervalMs);
    }

    paint(idx, false);

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            idx = (idx + 1) % quotes.length;
            paint(idx, !reduceMotion);
            if (playing) {
                schedule();
            }
        });
    }
    if (btnRandom) {
        btnRandom.addEventListener('click', () => {
            idx = pickRandomIndex(quotes, idx);
            paint(idx, !reduceMotion);
            if (playing) {
                schedule();
            }
        });
    }
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            playing = !playing;
            btnPause.textContent = playing ? 'Pause rotation' : 'Resume rotation';
            schedule();
        });
    }

    schedule();

    if (!wall) {
        return;
    }

    const ordered = reduceMotion ? quotes : shuffleArray(quotes);
    ordered.forEach((q) => {
        const card = document.createElement('article');
        card.className = 'quote-card';
        const color = q.color || '#ee8833';
        card.style.borderTopColor = color;
        card.innerHTML =
            '<p class="quote-card-text"></p>' +
            '<p class="quote-card-author"></p>';
        card.querySelector('.quote-card-text').textContent = q.text;
        const authorEl = card.querySelector('.quote-card-author');
        authorEl.textContent = q.author;
        authorEl.style.color = color;
        wall.appendChild(card);
    });

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
        wall.querySelectorAll('.quote-card').forEach((c) => c.classList.add('visible'));
        return;
    }

    const wallObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                wallObserver.unobserve(entry.target);
            }
        });
    }, { rootMargin: '40px 0px', threshold: 0.05 });

    wall.querySelectorAll('.quote-card').forEach((card, i) => {
        card.style.transitionDelay = Math.min(i * 30, 600) + 'ms';
        wallObserver.observe(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchLatestVersion();
    setupSmoothScroll();
    setupLazyVideos();
    setupNavbarScroll();

    const quotes = window.AB_LUXURY_QUOTES || [];
    setupHeroTicker(quotes);
    setupLuminaryQuotes(quotes);
});
