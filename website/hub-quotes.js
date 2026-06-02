(function () {
    var quotes = window.AB_LUXURY_QUOTES || [];
    var elStage = document.getElementById('hub-quote-stage');
    var elText = document.getElementById('hub-quote-text');
    var elAuthor = document.getElementById('hub-quote-author');
    if (!elText || !quotes.length) {
        if (elText) {
            elText.textContent = 'Quote data failed to load.';
        }
        return;
    }

    var reduceMotion = false;
    try {
        reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    var idx = Math.floor(Math.random() * quotes.length);

    function paint(i, fade) {
        var q = quotes[i];
        function apply() {
            elText.textContent = q.text;
            elAuthor.textContent = q.author;
            elAuthor.style.color = q.color || '#ffb347';
            if (elStage) {
                elStage.style.borderLeft = '2px solid ' + (q.color || '#ee8833');
                elStage.style.paddingLeft = '0.75rem';
            }
        }
        if (fade && !reduceMotion && elStage) {
            elStage.classList.add('dim');
            setTimeout(function () {
                apply();
                elStage.classList.remove('dim');
            }, 350);
        } else {
            apply();
        }
    }

    paint(idx, false);

    if (!reduceMotion) {
        setInterval(function () {
            idx = (idx + 1) % quotes.length;
            paint(idx, true);
        }, 12000);
    }
})();
