class Game {
    constructor() {
        // 1. Crear escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); // Pista Verde

        // 2. Configurar el Renderizador (Arreglo de pantalla negra)
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '1'; // Fuerza al canvas a ir al frente
        document.body.appendChild(this.renderer.domElement);

        // 3. Colocación de la Cámara
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 60, 75);

        // 4. Luces (Esenciales para que no se vea negro)
        const ambient = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(20, 100, 20);
        this.scene.add(sun);

        this.input = new InputHandler();
        this.totalLaps = 3; 

        // Circuito elíptico cerrado
        this.trackPoints = [
            new THREE.Vector3(0, 0, 45),       
            new THREE.Vector3(45, 0, 45),     
            new THREE.Vector3(65, 0, 0),      
            new THREE.Vector3(45, 0, -45),     
            new THREE.Vector3(0, 0, -45),     
            new THREE.Vector3(-45, 0, -45),     
            new THREE.Vector3(-65, 0, 0),    
            new THREE.Vector3(-45, 0, 45)
        ];
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);
        this.metaCenter = this.trackCurve.getPointAt(0); 

        this.createTrack();
        this.createMetaLine();
        this.initPlayers();
        this.buildCleanUI(); 
        
        this.setupAbilityListeners();

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    buildCleanUI() {
        let existiendo = document.getElementById('hud-racing');
        if (existiendo) existiendo.remove();

        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'hud-racing';
        this.uiContainer.style.position = 'absolute';
        this.uiContainer.style.top = '20px'; 
        this.uiContainer.style.left = '50%';
        this.uiContainer.style.transform = 'translateX(-50%)';
        this.uiContainer.style.fontFamily = 'monospace, sans-serif';
        this.uiContainer.style.backgroundColor = 'rgba(10, 25, 15, 0.85)';
        this.uiContainer.style.color = '#fff';
        this.uiContainer.style.padding = '15px 30px';
        this.ui
