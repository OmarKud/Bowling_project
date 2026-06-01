export default class Sizes {
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.pixelRatio = Math.min(window.devicePixelRatio, 2);
        this.callbacks = [];

        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.pixelRatio = Math.min(window.devicePixelRatio, 2);
            this.trigger();
        });
    }
 
    on(callback) {
        this.callbacks.push(callback);
    }

    trigger() {
        for (const callback of this.callbacks) {
            callback();
        }
    }
}