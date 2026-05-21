class InputHandler {
    constructor() {
        this.keys = {};

        // Escuchar cuando se presiona una tecla
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        // Escuchar cuando se suelta una tecla
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    // Controles Jugador 1 (Flechas del teclado)
    getPlayer1Input() {
        return {
            forward:  this.keys['arrowup']    || this.keys['up'],
            backward: this.keys['arrowdown']  || this.keys['down'],
            left:     this.keys['arrowleft']  || this.keys['left'],
            right:    this.keys['arrowright'] || this.keys['right']
        };
    }

    // Controles Jugador 2 (Teclas W, A, S, D)
    getPlayer2Input() {
        return {
            forward:  this.keys['w'],
            backward: this.keys['s'],
            left:     this.keys['a'],
            right:    this.keys['d']
        };
    }
}
