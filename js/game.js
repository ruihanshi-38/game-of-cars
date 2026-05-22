class Game {
    constructor() {
        // 1. Inicializar Escena con fondo verde original
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); 

        // 2. Configurar el Renderizador asegurando capas sobre el body
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '1'; // Canvas abajo, UI arriba
        document.body.appendChild(this.renderer.domElement);

        // 3. Configuración de Cámara Global
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 75, 85);

        // 4. Luces originales del juego para evitar sombras negras fatales
        const ambient = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(30, 100, 30);
        this.scene.add(sun);

        // Controladores y Estados del juego
        this.input = new InputHandler();
        this.totalLaps = 3; 
        this.globalMatchFrozen = false; 

        // Repositorios de colisiones del mapa
        this.turboMats = [];
        this.walls = [];

        // Trazado completo del circuito original (Curva cerrada elíptica)
        this.trackPoints = [
            new THREE.Vector3(0, 0, 40),       
            new THREE.Vector3(40, 0, 40),     
            new THREE.Vector3(60, 0, 0),      
            new THREE.Vector3(40, 0, -40),     
            new THREE.Vector3(0, 0, -40),     
            new THREE.Vector3(-40, 0, -40),     
            new THREE.Vector3(-60, 0, 0),    
            new THREE.Vector3(-40, 0, 40)
        ];
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);
        this.metaCenter = this.trackCurve.getPointAt(0); 

        // Inicialización de componentes en orden estricto de dependencias
        this.createTrack();
        this.createMetaLine(); 
        this.initPlayers();
        this.buildCleanUI(); 
        this.setupAbilityListeners();

        // Eventos del sistema
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Bindeo del loop de animación para evitar pérdidas de contexto
        this.loop = this.loop.bind(this);
    }

    // Vinculación directa con el panel de información original de tu HTML
    buildCleanUI() {
        this.speedValEl = document.getElementById('speed-val');
        this.lapValEl = document.getElementById('lap-val');
        this.circuitValEl = document.getElementById('circuit-val');
        
        if (this.circuitValEl) {
            this.circuitValEl.innerText = "1 (EXTREMO COMBATE)";
        }
    }

    // Geometría del circuito estable
    createTrack() {
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 64, 14, 8, true);
        const trackMesh = new THREE.Mesh(trackGeo, new THREE.MeshLambertMaterial({ color: 0x34495e }));
        trackMesh.scale.set(1, 0.005, 1); 
        this.scene.add(trackMesh);
    }

    // Línea de Meta original en el suelo del escenario
    createMetaLine() {
        const metaMesh = new THREE.Mesh(new THREE.BoxGeometry(28, 0.1, 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        metaMesh.position.copy(this.metaCenter);
        this.scene.add(metaMesh);
    }

    // Inicialización y posicionamiento inicial de los vehículos
    initPlayers() {
        this.cars = [
            new Car(this.scene, this.metaCenter.x - 4, this.metaCenter.z - 5, 0xe74c3c, 1), // J1 Rojo
            new Car(this.scene, this.metaCenter.x + 4, this.metaCenter.z - 5, 0x3498db, 2)  // J2 Azul
        ];
        
        // Habilidades iniciales asignadas
        this.cars[0].skills = ["BOOST", "WALL"]; 
        this.cars[1].skills = ["WALL", "FREEZE"]; 
        
        // Guardar registro de posiciones previas para que las metas no den 'undefined'
        this.previousCarPositions = [
            { x: this.cars[0].x, z: this.cars[0].z },
            { x: this.cars[1].x, z: this.cars[1].z }
        ];
    }

    // Captura de teclado para las habilidades sin interferir con el input.js
    setupAbilityListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.cars || !this.cars[0] || !this.cars[1]) return;
            const k = e.key.toLowerCase();

            // Jugador 1: K (Poder 1) y L (Poder 2)
            if (k === 'k') this.useSkill(this.cars[0], 0);
            if (k === 'l') this.useSkill(this.cars[0], 1);

            // Jugador 2: V (Poder 1) y B (Poder 2)
            if (k === 'v') this.useSkill(this.cars[1], 0);
            if (k === 'b') this.useSkill(this.cars[1], 1);
        });
    }

    // Ejecutor de habilidades interactivo
    useSkill(car, slot) {
        let skill = car.skills[slot]; 
        if (!skill || skill === "USADO") return;
        
        if (skill === "BOOST") {
            car.activateBoost();
        }
        else if (skill === "FREEZE") {
            const enemy = car.id === 1 ? this.cars[1] : this.cars[0];
            enemy.activateFreeze();
        }
        else if (skill === "WALL") {
            this.createDynamicWall(car);
        }
        
        // Quemar slot de habilidad usada
        car.skills[slot] = "USADO";
    }

    // Habilidad de Muro original tal y como la querías
    createDynamicWall(car) {
        // Creamos un prisma gris que simula una barrera de hormigón en la pista
        const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 2), new THREE.MeshLambertMaterial({ color: 0x95a5a6 }));
        
        // Se posiciona un poco por detrás o delante según la dirección del coche
        wallMesh.position.set(car.x, 1.5, car.z + (Math.cos(car.angle) * 4));
        wallMesh.rotation.y = car.angle;
        
        this.scene.add(wallMesh);
        
        // Lo añadimos al array de colisiones físicas con un radio de acción perimetral
        this.walls.push({ 
            mesh: wallMesh,
            x: wallMesh.position.x, 
            z: wallMesh.position.z, 
            radius: 3.8 
        });
    }

    // Disparador del bucle principal del motor
    start() { 
        this.loop(); 
    }

    // Loop de animación a 60 Fps controlado
    loop() {
        requestAnimationFrame(this.loop);
        
        // Verificación de existencia segura de objetos para evitar que rompa y se quede negro
        if (this.cars && this.cars[0] && this.cars[1]) {
            // 1. Físicas de movimiento independientes
            this.cars[0].update(this.input.getPlayer1Input());
            this.cars[1].update(this.input.getPlayer2Input());
            
            // 2. Control de colisiones ambientales y habilidades
            this.processCollisions();
            
            // 3. Control de pasos de vuelta y línea de meta
            this.processLapsAndMeta(); 
            
            // 4. Actualización de cámara y de la interfaz del panel
            this.cameraFollow();
            this.updateUI();

            // Almacenar el histórico de posiciones para el cálculo de la siguiente vuelta
            this.previousCarPositions[0] = { x: this.cars[0].x, z: this.cars[0].z };
            this.previousCarPositions[1] = { x: this.cars[1].x, z: this.cars[1].z };
        }
        
        // Renderizar la escena con la cámara activa
        this.renderer.render(this.scene, this.camera);
    }

    // Procesamiento de límites de pista y choques contra muros
    processCollisions() {
        // Colisión entre ambos vehículos (Coches se repelen)
        const distEntreCoches = Math.sqrt((this.cars[1].x - this.cars[0].x)**2 + (this.cars[1].z - this.cars[0].z)**2);
        if (distEntreCoches < 2.2) {
            this.cars[0].bounce();
            this.cars[1].bounce();
        }

        this.cars.forEach(car => {
            // Límites perimetrales aproximados del trazado elíptico
            const distCenter = Math.sqrt(car.x**2 + car.z**2);
            if (distCenter > 56 || distCenter < 24) {
                car.bounce();
            }

            // Colisiones físicas contra los muros de la habilidad WALL
            this.walls.forEach(w => {
                const distAlMuro = Math.sqrt((car.x - w.x)**2 + (car.z - w.z)**2);
                if (distAlMuro < w.radius) {
                    car.bounce();
                }
            });
        });
    }

    // Procesamiento y lógica de la línea de meta original
    processLapsAndMeta() {
        this.cars.forEach((car, index) => {
            const oldPos = this.previousCarPositions[index];
            if (!oldPos) return;

            // Detección de paso geométrico por la línea de meta (Cruzar el eje Z de la meta de manera controlada)
            if (oldPos.z < this.metaCenter.z && car.z >= this.metaCenter.z && Math.abs(car.x - this.metaCenter.x) < 16) {
                if (car.currentLap < this.totalLaps) {
                    car.currentLap++;
                } else {
                    alert(`¡FIN DE LA CARRERA! El Jugador ${car.id} ha ganado la partida.`);
                    // Reiniciar posiciones globales de carrera
                    this.initPlayers();
                }
            }
        });
    }

    // Enfoque dinámico intermedio de la cámara
    cameraFollow() {
        const midX = (this.cars[0].x + this.cars[1].x) / 2; 
        const midZ = (this.cars[0].z + this.cars[1].z) / 2;
        
        // Mantener una distancia y altura prudencial para que nunca se pierda de vista la pista
        this.camera.position.set(midX, 68, midZ + 68);
        this.camera.lookAt(midX, 0, midZ);
    }

    // Actualización del panel de información clásico del HTML original
    updateUI() {
        if (!this.speedValEl || !this.lapValEl) return;
        
        // Multiplicamos la velocidad interna por un valor estético de simulación (KM/H)
        let speedJ1 = Math.round(this.cars[0].speed * 320);
        let speedJ2 = Math.round(this.cars[1].speed * 320);
        
        // Inyectar datos en los campos nativos de tu HTML sin alterarlo
        this.speedValEl.innerHTML = `J1: <span style="color:#e74c3c;">${speedJ1}</span> | J2: <span style="color:#3498db;">${speedJ2}</span>`;
        this.lapValEl.innerHTML = `J1: ${this.cars[0].currentLap}/${this.totalLaps} [${this.cars[0].skills[0]}, ${this.cars[0].skills[1]}] | J2: ${this.cars[1].currentLap}/${this.totalLaps} [${this.cars[1].skills[0]}, ${this.cars[1].skills[1]}]`;
    }

    // Adaptabilidad instantánea ante cambios de tamaño de pantalla
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight; 
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Inicialización de seguridad al terminar la carga del DOM
window.addEventListener('load', () => {
    setTimeout(() => {
        try {
            const game = new Game(); 
            game.start(); 
        } catch(error) {
            console.error("Error crítico al arrancar Three.js:", error);
        }
    }, 150);
});
