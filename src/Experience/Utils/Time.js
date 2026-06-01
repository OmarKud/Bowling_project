export default class Time {
    constructor() {
        this.start = Date.now();
        this.current = this.start;
        this.elapsed = 0;
        this.delta = 16;
        this.callbacks = [];

        window.requestAnimationFrame(() => {
            this.tick();
        });
    }

    on(callback) {
        this.callbacks.push(callback);
    }

    tick() {
        const currentTime = Date.now();
        this.delta = currentTime - this.current;
        this.current = currentTime;
        this.elapsed = this.current - this.start;

        this.trigger();

        window.requestAnimationFrame(() => {
            this.tick();
        });
    }

    trigger() {
        for (const callback of this.callbacks) {
            callback();
        }
    }
}