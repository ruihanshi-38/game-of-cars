class Game {
    constructor() {
        // 1. Configuración de Escena y Renderizador 3D
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); // Césped de fondo

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // 2. Cámara desde arriba (Aérea Isométrica con inclinación cinematográfica)
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 75, 75);
        this.camera.lookAt(0, 0, 15);

        // 3. Luces del Mundo
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionLight(0xffffff, 0.8);
        dirLight.position.set(40, 100, 20);
        this.scene.add(dirLight);

        this.input = new InputHandler();
        this.totalLaps = 3;

        // --- DISEÑO DEL NUEVO CIRCUITO EXTREMO (Anchura: 18, lleno de curvas) ---
        // Generamos la carretera como un tubo plano extruido que recorre estos vectores espaciales
        this.trackPoints = [
            new THREE.Vector3(0, 0, 40),      // Meta
            new THREE.Vector3(50, 0, 40),     // Recta principal
            new THREE.Vector3(80, 0, 20),     // Curva 1 cerrada hacia arriba
            new THREE.Vector3(80, 0, -40),    // Recta trasera este
            new THREE.Vector3(50, 0, -60),    // Horquilla Nordeste
            new THREE.Vector3(10, 0, -30),    // Diagonal interior lenta
            new THREE.Vector3(-20, 0, -60),   // Chicane agresiva entrada
            new THREE.Vector3(-40, 0, -30),   // Chicane agresiva salida
            new THREE.Vector3(-80, 0, -40),   // Curva parabólica Noroeste
            new THREE.Vector3(-75, 0, 10),    // Recta oeste de aceleración
            new THREE.Vector3(-40, 0, 10),    // Curva de 90 grados
            new THREE.Vector3(-40, 0, 40)     // Curva final de entrada a meta
        ];

        this.create3DTrack();
        this.initPlayers();

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    create3DTrack() {
        // Crear una curva suave que una todos nuestros puntos difíciles
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);
        
        // Generar la geometría de la carretera (Carretera extra ancha: radio 9 = 18 unidades de ancho total)
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 120, 9, 16, true);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); // Asfalto Gris
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        
        // Aplastamos el tubo en el eje Y para transformarlo en una pista plana y ancha
        trackMesh.scale.set(1, 0.02, 1);
        trackMesh.position.y = 0.01;
        this.scene.add(trackMesh);

        // Línea de Meta (Un plano a cuadros blanco y negro sobre la pista)
        const finishGeo = new THREE.PlaneGeometry(18, 2);
        const finishMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        this.finishLine = new THREE.Mesh(finishGeo, finishMat);
        this.finishLine.rotation.x = Math.PI / 2;
        this.finishLine.position.set(0, 0.05, 40); // Ubicada exactamente en el nodo inicial
        this.scene.add(this.finishLine);
    }

    initPlayers() {
        // Colocamos a los dos coches en paralelo en la línea de salida (Meta a Z = 40)
        // El coche rojo (J1) y azul (J2) alineados lado a lado en la pista ancha
        this.cars = [
            new Car(this.scene, -3, 40, 0xe74c3c, 1), // Jugador 1
            new Car(this.scene, 3, 40, 0x3498db, 2)   // Jugador 2
        ];

        // Orientar chasis mirando hacia la recta (Este)
        this.cars.forEach(car => {
            car.angle = -Math.PI / 2; 
        });
    }

    start() {
        this.loop();
    }

    loop() {
        requestAnimationFrame(this.loop);
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    update() {
        const p1Input = this.input.getPlayer1Input();
        const p2Input = this.input.getPlayer2Input();

        if (this.cars[0]) this.cars[0].update(p1Input);
        if (this.cars[1]) this.cars[1].update(p2Input);

        this.processTrackCollisions();
        this.processCarToCarCollisions();
        this.processLapSystem();
        this.updateCameraFollow();
        this.updateUI();
    }

    processTrackCollisions() {
        // En 3D calculamos la distancia más corta de cada coche hacia el eje central de la curva
        this.cars.forEach(car => {
            const carPosition = new THREE.Vector3(car.x, 0, car.z);
            const closestPoint = this.getClosestPointOnCurve(carPosition, this.trackCurve);

            const distance = carPosition.distanceTo(closestPoint);
            
            // Si la distancia al centro es mayor que el radio de la carretera ancha (9), se sale de la pista
            if (distance > 8.6) {
                car.bounce();
                // Lo empujamos de vuelta hacia el asfalto para evitar atascos permanentes
                const pushDir = new THREE.Vector3().subVectors(closestPoint, carPosition).normalize();
                car.x += pushDir.x * 0.5;
                car.z += pushDir.z * 0.5;
            }
        });
    }

    getClosestPointOnCurve(pos, curve) {
        // Muestreo rápido para encontrar el punto óptimo del circuito
        let minPositions = curve.getPoints(100);
        let closest = minPositions[0];
        let minDist = pos.distanceTo(closest);
        
        for (let i = 1; i < minPositions.length; i++) {
            let dist = pos.distanceTo(minPositions[i]);
            if (dist < minDist) {
                minDist = dist;
                closest = minPositions[i];
            }
        }
        return closest;
    }

    processCarToCarCollisions() {
        const carA = this.cars[0];
        const carB = this.cars[1];
        if (!carA || !carB) return;

        // Distancia euclidiana tridimensional entre mallas
        const dx = carB.x - carA.x;
        const dz = carB.z - carA.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDist = 2.0; // Distancia límite por volumen de mallas

        if (distance < minDist) {
            carA.bounce();
            carB.bounce();

            const overlap = minDist - distance;
            carA.x -= (dx / (distance || 1)) * overlap * 0.5;
            carA.z -= (dz / (distance || 1)) * overlap * 0.5;
            carB.x += (dx / (distance || 1)) * overlap * 0.5;
            carB.z += (dz / (distance || 1)) * overlap * 0.5;
        }
    }

    processLapSystem() {
        this.cars.forEach(car => {
            // Checkpoint intermedio del circuito extremo (Zona norte)
            if (car.z < -20) {
                car.passedCheckpoint = true;
            }

            // Cruce de línea de meta (X está cerca de 0, Z está cruzando la línea 40)
            if (car.passedCheckpoint && car.z >= 38 && car.z <= 42 && Math.abs(car.x) < 10) {
                car.passedCheckpoint = false;
                
                if (car.currentLap < this.totalLaps) {
                    car.currentLap++;
                } else {
                    alert(`¡FIN DE LA CARRERA! Victoria absoluta del JUGADOR ${car.id} en el circuito 3D.`);
                    
                    // Reiniciar posiciones tras la victoria
                    this.cars[0].x = -3; this.cars[0].z = 40; this.cars[0].speed = 0; this.cars[0].angle = -Math.PI / 2; this.cars[0].currentLap = 1;
                    this.cars[1].x = 3;  this.cars[1].z = 40; this.cars[1].speed = 0; this.cars[1].angle = -Math.PI / 2; this.cars[1].currentLap = 1;
                }
            }
        });
    }

    updateCameraFollow() {
        // La cámara calcula el punto medio exacto entre el Jugador 1 y el Jugador 2
        // Esto permite un efecto de cámara dinámica que los sigue a ambos por igual
        if (!this.cars[0] || !this.cars[1]) return;
        
        const midX = (this.cars[0].x + this.cars[1].x) / 2;
        const midZ = (this.cars[0].z + this.cars[1].z) / 2;

        // Movimiento suavizado de cámara (Interpolación lineal)
        this.camera.position.x += (midX - this.camera.position.x) * 0.05;
        this.camera.position.z += ((midZ + 65) - this.camera.position.z) * 0.05;
        this.camera.lookAt(midX, 0, midZ);
    }

    updateUI() {
        const speedEl = document.getElementById('speed-val');
        const lapEl = document.getElementById('lap-val');

        if (speedEl && this.cars[0] && this.cars[1]) {
            const s1 = Math.round(Math.abs(this.cars[0].speed) * 60);
            const s2 = Math.round(Math.abs(this.cars[1].speed) * 60);
            speedEl.innerText = `J1(Rojo): ${s1} | J2(Azul): ${s2}`;
        }

        if (lapEl && this.cars[0] && this.cars[1]) {
            lapEl.innerText = `J1: ${this.cars[0].currentLap}/${this.totalLaps} | J2: ${this.cars[1].currentLap}/${this.totalLaps}`;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Inicialización inteligente y segura para entornos gráficos 3D
window.addEventListener('load', () => {
    // Esperamos dinámicamente en bucle hasta que Three.js se cargue por completo desde el CDN
    const comprobarLibrerias = setInterval(() => {
        if (typeof THREE !== 'undefined') {
            clearInterval(comprobarLibrerias); // Frenamos la espera
            try {
                console.log("¡Three.js detectado con éxito! Arrancando motor gráfico...");
                const game = new Game();
                game.start();
            } catch (error) {
                console.error("Error al inicializar los componentes del juego 3D:", error);
            }
        } else {
            console.warn("Esperando a que el servidor CDN responda con los paquetes de Three.js...");
        }
    }, 100);
});
