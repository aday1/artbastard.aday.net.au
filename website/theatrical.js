(function () {
    "use strict";

    var DEFAULT_SPOT = "#ee8833";

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

    function setSpotColor(color) {
        var rgb = hexToRgb(color || DEFAULT_SPOT);
        document.documentElement.style.setProperty("--spot-color", color || DEFAULT_SPOT);
        document.documentElement.style.setProperty("--spot-rgb", rgb);
        var cans = document.querySelectorAll(".rig-can");
        if (cans.length > 0) {
            cans[Math.floor(cans.length / 2)].style.setProperty("--can-rgb", rgb);
        }
    }

    window.ArtBastardTheatrical = {
        setSpotColor: setSpotColor,
    };

    function scrollToHashTarget() {
        var hash = window.location.hash;
        if (!hash || hash.length < 2) {
            return;
        }
        var target = document.querySelector(hash);
        if (!target) {
            return;
        }
        target.scrollIntoView({ block: "start" });
    }

    function openCurtains(theatre) {
        if (!theatre) return;
        var reduced = prefersReducedMotion();

        function reveal() {
            theatre.classList.add("is-open");
            var whisper = document.getElementById("theatre-whisper");
            if (whisper) {
                whisper.textContent =
                    "The house lights dim. The bastard awakens. " +
                    "The Wind Dancing Masters would find our DMX channels... adequate.";
            }
            if (window.location.hash) {
                setTimeout(scrollToHashTarget, reduced ? 0 : 350);
            }
        }

        if (reduced) {
            reveal();
            return;
        }

        // Hold fully closed, then part the coulisse.
        setTimeout(reveal, 1200);
    }

    function setupSpotlight() {
        var wash = document.querySelector(".spotlight-wash");
        if (!wash) return;

        var reduced = prefersReducedMotion();
        var x = 50;
        var y = 38;

        function apply(xPct, yPct) {
            document.documentElement.style.setProperty("--spot-x", xPct + "%");
            document.documentElement.style.setProperty("--spot-y", yPct + "%");
        }

        apply(x, y);

        if (reduced || window.matchMedia("(max-width: 768px)").matches) {
            return;
        }

        var pending = false;
        function onMove(ev) {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () {
                x = (ev.clientX / window.innerWidth) * 100;
                y = (ev.clientY / window.innerHeight) * 100;
                apply(x, y);
                pending = false;
            });
        }

        window.addEventListener("pointermove", onMove, { passive: true });
    }

    function init() {
        var theatre = document.querySelector(".theatre");
        if (theatre) {
            openCurtains(theatre);
        }
        setupSpotlight();
        setSpotColor(DEFAULT_SPOT);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
