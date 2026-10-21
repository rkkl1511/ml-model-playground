import "@testing-library/jest-dom";

// jsdom does not implement matchMedia, and framer-motion asks for it.
if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

// Nor IntersectionObserver, which the "while in view" animations use to
// decide when to start.
if (!window.IntersectionObserver) {
    class FakeIntersectionObserver {
        constructor(callback) {
            this.callback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
            return [];
        }
    }
    window.IntersectionObserver = FakeIntersectionObserver;
    global.IntersectionObserver = FakeIntersectionObserver;
}
