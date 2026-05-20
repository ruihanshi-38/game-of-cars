class InputHandler {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        window.addEventListener('keydown', (e) => this.setKeyState(e.key, true));
        window.addEventListener('keyup', (e) => this.setKeyState(e.key, false));
    }

    setKeyState(key, isPressed) {
        switch (key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                this.keys.forward = isPressed;
                break;
            case 'arrowdown':
            case 's':
                this.keys.backward = isPressed;
                break;
            case 'arrowleft':
            case 'a':
                this.keys.left = isPressed;
                break;
            case 'arrowright':
            case 'd':
                this.keys.right = isPressed;
                break;
        }
    }
}
