(function () {
    var quotes = window.AB_LUXURY_QUOTES || [];
    if (!window.ArtBastardLuminary) {
        return;
    }

    window.ArtBastardLuminary.initLuminaryPage({
        quotes: quotes,
        countEl: document.getElementById("docs-quote-wall-count"),
        wallEl: document.getElementById("docs-quote-wall"),
        rotator: {
            quotes: quotes,
            stageEl: document.getElementById("docs-luminary-stage"),
            textEl: document.getElementById("docs-quote-text"),
            authorEl: document.getElementById("docs-quote-author"),
            metaEl: document.getElementById("docs-quote-meta"),
            btnNext: document.getElementById("btn-docs-next"),
            btnRandom: document.getElementById("btn-docs-random"),
            btnPause: document.getElementById("btn-docs-pause"),
            authorPrefix: "\u2014 ",
            intervalMs: 18000,
            borderLeftWide: true,
            fadeMs: 420,
        },
    });
})();
