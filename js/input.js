class InputHandler {
    constructor() {
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            const keyName = e.key.toLowerCase();
            this.keys[keyName] = true;

            // Evitar comportamiento por defecto del scroll de ventana al usar las flechas o espacio
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'spacebar'].includes(keyName)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Limpiar teclas al perder foco de ventana para evitar autos que aceleran solos
        window.addEventListener('blur', () => {
            this.keys = {};
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
