document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const featuresHeading = document.querySelector(".features-section h2");
    const cards = [...document.querySelectorAll(".feature-card")];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    const compactLayout = window.matchMedia("(max-width: 767px)");
    const controller = new AbortController();
    let scrollFrame = 0;
    let pointerFrame = 0;
    let headingTop = 0;
    let refreshHeadingPosition = true;
    let activeCard = null;
    let pointerX = 0;
    let pointerY = 0;

    const clamp = (value) => Math.min(1, Math.max(0, value));

    const refreshHeadingMetrics = () => {
        if (!featuresHeading) return;
        headingTop = featuresHeading.getBoundingClientRect().top + window.scrollY;
        refreshHeadingPosition = false;
    };

    const updateScrollAnimation = () => {
        scrollFrame = 0;
        if (refreshHeadingPosition) refreshHeadingMetrics();
        if (!featuresHeading) return;

        const viewportHeight = window.innerHeight;
        const headingProgress = clamp(
            (viewportHeight * 0.85 - (headingTop - window.scrollY)) / (viewportHeight * 0.55)
        );
        const maxScale = compactLayout.matches ? 1.02 : 1.05;
        const scale = 1 + (maxScale - 1) * headingProgress;
        const scaleValue = scale.toFixed(3);
        if (featuresHeading.style.getPropertyValue("--scroll-scale") !== scaleValue) {
            featuresHeading.style.setProperty("--scroll-scale", scaleValue);
        }
    };

    const scheduleScrollAnimation = () => {
        if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollAnimation);
    };

    const updateCardTilt = () => {
        pointerFrame = 0;
        if (!activeCard) return;

        const bounds = activeCard.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;

        const x = clamp((pointerX - bounds.left) / bounds.width);
        const y = clamp((pointerY - bounds.top) / bounds.height);
        activeCard.style.setProperty("--rotate-x", `${((0.5 - y) * 6).toFixed(2)}deg`);
        activeCard.style.setProperty("--rotate-y", `${((x - 0.5) * 6).toFixed(2)}deg`);
    };

    if (!reduceMotion) {
        root.classList.add("motion-enabled");

        const revealElements = [
            ...document.querySelectorAll(".features-section .tagline, .features-section h2, .feature-card")
        ];

        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("scroll-visible");
                    observer.unobserve(entry.target);
                });
            }, { rootMargin: "0px 0px -5% 0px", threshold: 0.05 });

            revealElements.forEach((element) => observer.observe(element));
            window.addEventListener("pagehide", () => observer.disconnect(), {
                once: true,
                signal: controller.signal
            });
        } else {
            revealElements.forEach((element) => element.classList.add("scroll-visible"));
        }

        window.addEventListener("scroll", scheduleScrollAnimation, {
            passive: true,
            signal: controller.signal
        });
        window.addEventListener("resize", () => {
            refreshHeadingPosition = true;
            scheduleScrollAnimation();
        }, { passive: true, signal: controller.signal });
        scheduleScrollAnimation();

        let pointerController = null;
        const disableCardTilt = () => {
            pointerController?.abort();
            pointerController = null;
            activeCard = null;
            if (pointerFrame) {
                window.cancelAnimationFrame(pointerFrame);
                pointerFrame = 0;
            }
            cards.forEach((card) => {
                card.classList.remove("is-pointer-active", "is-hovered");
                card.style.setProperty("--rotate-x", "0deg");
                card.style.setProperty("--rotate-y", "0deg");
            });
        };

        const enableCardTilt = () => {
            if (!finePointer.matches || pointerController) return;
            pointerController = new AbortController();

            cards.forEach((card) => {
                card.addEventListener("pointerenter", () => {
                    card.classList.add("is-hovered", "is-pointer-active");
                }, { signal: pointerController.signal });

                card.addEventListener("pointermove", (event) => {
                    activeCard = card;
                    pointerX = event.clientX;
                    pointerY = event.clientY;
                    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updateCardTilt);
                }, { passive: true, signal: pointerController.signal });

                card.addEventListener("pointerleave", () => {
                    if (activeCard === card) activeCard = null;
                    card.classList.remove("is-pointer-active", "is-hovered");
                    card.style.setProperty("--rotate-x", "0deg");
                    card.style.setProperty("--rotate-y", "0deg");
                    if (pointerFrame) {
                        window.cancelAnimationFrame(pointerFrame);
                        pointerFrame = 0;
                    }
                }, { signal: pointerController.signal });
            });

        };

        finePointer.addEventListener("change", () => {
            if (finePointer.matches) enableCardTilt();
            else disableCardTilt();
        }, { signal: controller.signal });
        enableCardTilt();
    } else {
        document.querySelectorAll(".features-section .tagline, .features-section h2, .feature-card")
            .forEach((element) => element.classList.add("scroll-visible"));
    }

    window.addEventListener("pagehide", () => {
        controller.abort();
        if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
        if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    }, { once: true });
});
