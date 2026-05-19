// Fetch latest release version from GitHub
async function fetchLatestVersion() {
    try {
        const response = await fetch('https://api.github.com/repos/aday1/ArtBastard-DMX512/releases/latest');
        if (response.ok) {
            const data = await response.json();
            const versionElement = document.getElementById('latest-version');
            if (versionElement) {
                versionElement.textContent = data.tag_name || 'v5.12.0';
            }
        }
    } catch (error) {
        console.error('Failed to fetch latest version:', error);
        const versionElement = document.getElementById('latest-version');
        if (versionElement) {
            versionElement.textContent = 'v5.12.0';
        }
    }
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Update GitHub username in links
function updateGitHubLinks() {
    // GitHub username is already set to 'aday1' in HTML
    // This function kept for compatibility
    const username = 'aday1';
    document.querySelectorAll('a[href*="yourusername"]').forEach(link => {
        link.href = link.href.replace('yourusername', username);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchLatestVersion();
    updateGitHubLinks();
    
    // Add scroll effect to navbar
    let lastScroll = 0;
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 100) {
            navbar.style.background = 'rgba(10, 10, 15, 0.95)';
        } else {
            navbar.style.background = 'rgba(10, 10, 15, 0.8)';
        }
        lastScroll = currentScroll;
    });
});

