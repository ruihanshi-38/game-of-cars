class InputHandler {
    constructor() {
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    // Jugador 1: Flechas de dirección
    getPlayer1Input() {
        return {
            forward:  this.keys['arrowup']    || this.keys['up'],
            backward: this.keys['arrowdown']  || this.keys['down'],
            left:     this.keys['arrowleft']  || this.keys['left'],
            right:    this.keys['arrowright'] || this.keys['right']
        };
    }

    // Jugador 2: Teclas W, A, S, D
    getPlayer2Input() {
        return {
            forward:  this.keys['w'],
            backward: this.keys['s'],
            left:     this.keys['a'],
            right:    this.keys['d']
        };
    }
}
