class InputHandler {
    constructor() {
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    getPlayer1Input() {
        return {
            forward: this.keys['ArrowUp'] || false,
            backward: this.keys['ArrowDown'] || false,
            left: this.keys['ArrowLeft'] || false,
            right: this.keys['ArrowRight'] || false
        };
    }

    getPlayer2Input() {
        return {
            forward: this.keys['w'] || this.keys['W'] || false,
            backward: this.keys['s'] || this.keys['S'] || false,
            left: this.keys['a'] || this.keys['A'] || false,
            right: this.keys['d'] || this.keys['D'] || false
        };
    }
}
