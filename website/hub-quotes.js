(function () {
    var quotes = window.AB_LUXURY_QUOTES || [];
    if (!window.ArtBastardLuminary) {
        return;
    }

    window.ArtBastardLuminary.setupRotator({
        quotes: quotes,
        stageEl: document.getElementById("hub-quote-stage"),
        textEl: document.getElementById("hub-quote-text"),
        authorEl: document.getElementById("hub-quote-author"),
        metaEl: document.getElementById("hub-quote-meta"),
        intervalMs: 12000,
        borderLeft: true,
        fadeMs: 350,
    });

    var wall = document.getElementById("hub-quote-wall");
    var countEl = document.getElementById("hub-quote-wall-count");
    if (countEl) {
        countEl.textContent = String(quotes.length);
    }
    if (wall) {
        window.ArtBastardLuminary.buildQuoteWall(wall, quotes);
    }
})();
