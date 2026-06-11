(function () {
    "use strict";

    function hexToRgb(hex) {
        hex = String(hex || "").replace("#", "");
        if (hex.length === 3) {
            hex = hex.split("").map(function (c) { return c + c; }).join("");
        }
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        if (isNaN(r)) return "238, 136, 51";
        return r + ", " + g + ", " + b;
    }

    function prefersReducedMotion() {
        try {
            return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (e) {
            return false;
        }
    }

    function shuffleArray(arr) {
        var copy = arr.slice();
        for (var i = copy.length - 1; i > 0; i -= 1) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    function pickRandomIndex(quotes, current) {
        if (quotes.length <= 1) return 0;
        var n = Math.floor(Math.random() * quotes.length);
        return n === current ? (n + 1) % quotes.length : n;
    }

    function syncSpotColor(color) {
        if (window.ArtBastardTheatrical && window.ArtBastardTheatrical.setSpotColor) {
            window.ArtBastardTheatrical.setSpotColor(color || "#ee8833");
        }
    }

    function buildQuoteWall(wallEl, quotes, options) {
        if (!wallEl || !quotes.length) return;
        var reduceMotion = (options && options.reduceMotion) || prefersReducedMotion();
        wallEl.innerHTML = "";
        var ordered = reduceMotion ? quotes : shuffleArray(quotes);
        ordered.forEach(function (q) {
            var card = document.createElement("article");
            card.className = "quote-card";
            var color = q.color || "#ee8833";
            card.style.borderTopColor = color;
            var textEl = document.createElement("p");
            textEl.className = "quote-card-text";
            textEl.textContent = q.text;
            var authorEl = document.createElement("p");
            authorEl.className = "quote-card-author";
            authorEl.textContent = q.author;
            authorEl.style.color = color;
            card.appendChild(textEl);
            card.appendChild(authorEl);
            wallEl.appendChild(card);
        });
        if (reduceMotion || typeof IntersectionObserver === "undefined") {
            wallEl.querySelectorAll(".quote-card").forEach(function (c) {
                c.classList.add("visible");
            });
            return;
        }
        var wallObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    wallObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: "40px 0px", threshold: 0.05 });
        wallEl.querySelectorAll(".quote-card").forEach(function (card, i) {
            card.style.transitionDelay = Math.min(i * 30, 600) + "ms";
            wallObserver.observe(card);
        });
    }

    function setupRotator(config) {
        var quotes = config.quotes || window.AB_LUXURY_QUOTES || [];
        var elBox = config.stageEl;
        var elText = config.textEl;
        var elAuthor = config.authorEl;
        var elMeta = config.metaEl;
        var useCite = config.useCite === true;
        var authorPrefix = config.authorPrefix || "";
        var intervalMs = config.intervalMs || 18000;
        var onPaint = config.onPaint || null;

        if (!elText || !quotes.length) {
            if (elText) elText.textContent = "Quote data failed to load.";
            return null;
        }

        var reduceMotion = prefersReducedMotion();
        var idx = pickRandomIndex(quotes, -1);
        var playing = !reduceMotion;
        var timer = null;

        function paint(i, fade) {
            var q = quotes[i];
            var rgb = hexToRgb(q.color || "#0066ff");
            function apply() {
                elText.textContent = q.text;
                if (elAuthor) {
                    elAuthor.textContent = authorPrefix + q.author;
                    elAuthor.style.color = q.color || "#0066ff";
                }
                if (elBox) {
                    if (config.borderLeft) {
                        elBox.style.borderLeft = "2px solid " + (q.color || "#ee8833");
                        elBox.style.paddingLeft = "0.75rem";
                    }
                    if (config.borderLeftWide) {
                        elBox.style.borderLeftColor = q.color || "#0066ff";
                        elBox.style.background = "rgba(" + rgb + ", 0.1)";
                        elBox.style.boxShadow =
                            "0 8px 32px rgba(0, 0, 0, 0.45), 0 0 40px rgba(" + rgb + ", 0.12)";
                    }
                    if (config.boxBorder) {
                        elBox.style.borderColor = q.color || "#ee8833";
                        elBox.style.boxShadow = "0 0 24px rgba(" + rgb + ", 0.15)";
                    }
                }
                if (elMeta) {
                    elMeta.textContent = "quote " + (i + 1) + " / " + quotes.length;
                }
                syncSpotColor(q.color);
                if (onPaint) onPaint(q, i);
            }
            if (fade && !reduceMotion && elBox) {
                elBox.classList.add("dim");
                setTimeout(function () {
                    apply();
                    elBox.classList.remove("dim");
                }, config.fadeMs || 400);
            } else {
                apply();
            }
        }

        function schedule() {
            clearInterval(timer);
            if (!playing || reduceMotion || intervalMs <= 0) return;
            timer = setInterval(function () {
                idx = (idx + 1) % quotes.length;
                paint(idx, true);
            }, intervalMs);
        }

        paint(idx, false);

        if (config.btnNext) {
            config.btnNext.addEventListener("click", function () {
                idx = (idx + 1) % quotes.length;
                paint(idx, !reduceMotion);
                if (playing) schedule();
            });
        }
        if (config.btnRandom) {
            config.btnRandom.addEventListener("click", function () {
                idx = pickRandomIndex(quotes, idx);
                paint(idx, !reduceMotion);
                if (playing) schedule();
            });
        }
        if (config.btnPause) {
            config.btnPause.addEventListener("click", function () {
                playing = !playing;
                config.btnPause.textContent = playing ? "Pause rotation" : "Resume rotation";
                schedule();
            });
        }

        schedule();
        return { paint: paint, getIndex: function () { return idx; } };
    }

    function initLuminaryPage(options) {
        var quotes = window.AB_LUXURY_QUOTES || [];
        if (options.countEl) {
            options.countEl.textContent = String(quotes.length);
        }
        setupRotator(options.rotator);
        if (options.wallEl) {
            buildQuoteWall(options.wallEl, quotes);
        }
    }

    window.ArtBastardLuminary = {
        hexToRgb: hexToRgb,
        buildQuoteWall: buildQuoteWall,
        setupRotator: setupRotator,
        initLuminaryPage: initLuminaryPage,
        pickRandomIndex: pickRandomIndex,
    };
})();
