// TouchTexture class - maneja los efectos de interacción del mouse
class TouchTexture {
  constructor() {
    this.size = 64;
    this.width = this.height = this.size;
    this.maxAge = 64;
    this.radius = 0.15 * this.size;
    this.speed = 1 / this.maxAge;
    this.trail = [];
    this.last = null;
    this.initTexture();
  }

  initTexture() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.Texture(this.canvas);
  }

  update() {
    this.clear();
    const speed = this.speed;
    const maxAge = this.maxAge;
    const trail = this.trail;

    // Optimización: usar índice en lugar de splice para mejor rendimiento
    let writeIndex = 0;
    for (let i = 0; i < trail.length; i++) {
      const point = trail[i];
      const f = point.force * speed * (1 - point.age / maxAge);
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;

      if (point.age <= maxAge) {
        this.drawPoint(point);
        if (writeIndex !== i) {
          trail[writeIndex] = point;
        }
        writeIndex++;
      }
    }

    // Reducir array solo al final
    trail.length = writeIndex;
    this.texture.needsUpdate = true;
  }

  clear() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point) {
    let force = 0;
    let vx = 0;
    let vy = 0;
    const last = this.last;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      let d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 10000, 1.0);
    }
    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  drawPoint(point) {
    const pos = {
      x: point.x * this.width,
      y: (1 - point.y) * this.height
    };
    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;
    const radius = this.radius;
    let color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255
      }, ${intensity * 255}`;
    let offset = this.size * 5;
    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius * 1;
    this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;
    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(255,0,0,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

// GradientBackground class - crea el fondo animado
class GradientBackground {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.mesh = null;
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight)
      },
      // Colores en tonos azules (del más claro al más oscuro)
      uColor1: { value: new THREE.Vector3(0.055, 0.647, 0.914) }, // #0ea5e9 - Azul cielo
      uColor2: { value: new THREE.Vector3(0.118, 0.251, 0.686) }, // #1e40af - Azul profundo
      uColor3: { value: new THREE.Vector3(0.219, 0.498, 0.808) }, // #387fce - Azul medio
      uColor4: { value: new THREE.Vector3(0.039, 0.196, 0.486) }, // #0a327c - Azul oscuro
      uColor5: { value: new THREE.Vector3(0.129, 0.588, 0.953) }, // #2196f3 - Azul brillante
      uColor6: { value: new THREE.Vector3(0.047, 0.137, 0.369) }, // #0c235e - Azul muy oscuro
      uSpeed: { value: 0.5 },
      uIntensity: { value: 0.8 },
      uTouchTexture: { value: null },
      uGrainIntensity: { value: 0.05 }
    };
  }

  init() {
    const viewSize = this.sceneManager.getViewSize();
    const geometry = new THREE.PlaneGeometry(
      viewSize.width,
      viewSize.height,
      1,
      1
    );
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vec3 pos = position.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
          vUv = uv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform vec3 uColor4;
        uniform vec3 uColor5;
        uniform vec3 uColor6;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform sampler2D uTouchTexture;
        uniform float uGrainIntensity;
        varying vec2 vUv;
        #define PI 3.14159265359

        // Función de ruido para efecto de grano
        float grain(vec2 uv, float time) {
          vec2 grainUv = uv * uResolution * 0.5;
          float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
          return grainValue * 2.0 - 1.0;
        }

        vec3 getGradientColor(vec2 uv, float time) {
          // Múltiples centros animados con diferentes velocidades (reducidas para menos movimiento)
          vec2 center1 = vec2(
            0.5 + sin(time * uSpeed * 0.15) * 0.2,
            0.5 + cos(time * uSpeed * 0.2) * 0.2
          );
          vec2 center2 = vec2(
            0.5 + cos(time * uSpeed * 0.25) * 0.25,
            0.5 + sin(time * uSpeed * 0.18) * 0.25
          );
          vec2 center3 = vec2(
            0.5 + sin(time * uSpeed * 0.12) * 0.22,
            0.5 + cos(time * uSpeed * 0.22) * 0.22
          );
          vec2 center4 = vec2(
            0.5 + cos(time * uSpeed * 0.2) * 0.2,
            0.5 + sin(time * uSpeed * 0.15) * 0.2
          );
          vec2 center5 = vec2(
            0.5 + sin(time * uSpeed * 0.3) * 0.18,
            0.5 + cos(time * uSpeed * 0.25) * 0.18
          );
          vec2 center6 = vec2(
            0.5 + cos(time * uSpeed * 0.18) * 0.25,
            0.5 + sin(time * uSpeed * 0.28) * 0.25
          );

          float dist1 = length(uv - center1);
          float dist2 = length(uv - center2);
          float dist3 = length(uv - center3);
          float dist4 = length(uv - center4);
          float dist5 = length(uv - center5);
          float dist6 = length(uv - center6);

          // Influencias de gradiente
          float influence1 = 1.0 - smoothstep(0.0, 0.6, dist1);
          float influence2 = 1.0 - smoothstep(0.0, 0.6, dist2);
          float influence3 = 1.0 - smoothstep(0.0, 0.6, dist3);
          float influence4 = 1.0 - smoothstep(0.0, 0.6, dist4);
          float influence5 = 1.0 - smoothstep(0.0, 0.6, dist5);
          float influence6 = 1.0 - smoothstep(0.0, 0.6, dist6);

          // Capa de rotación para profundidad (velocidad reducida)
          vec2 rotatedUv = uv - 0.5;
          float angle = time * uSpeed * 0.05;
          rotatedUv = vec2(
            rotatedUv.x * cos(angle) - rotatedUv.y * sin(angle),
            rotatedUv.x * sin(angle) + rotatedUv.y * cos(angle)
          );
          rotatedUv += 0.5;
          float radialGradient = length(rotatedUv - 0.5);
          float radialInfluence = 1.0 - smoothstep(0.0, 0.7, radialGradient);

          // Mezclar todos los colores
          vec3 color = vec3(0.0);
          color += uColor1 * influence1 * (0.5 + 0.5 * sin(time * uSpeed));
          color += uColor2 * influence2 * (0.5 + 0.5 * cos(time * uSpeed * 1.1));
          color += uColor3 * influence3 * (0.5 + 0.5 * sin(time * uSpeed * 0.7));
          color += uColor4 * influence4 * (0.5 + 0.5 * cos(time * uSpeed * 1.2));
          color += uColor5 * influence5 * (0.5 + 0.5 * sin(time * uSpeed * 0.9));
          color += uColor6 * influence6 * (0.5 + 0.5 * cos(time * uSpeed * 0.8));

          // Agregar overlay radial
          color += mix(uColor1, uColor3, radialInfluence) * 0.3;

          // Limitar y aplicar intensidad
          color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;

          // Mejorar saturación
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(vec3(luminance), color, 1.2);

          return color;
        }

        void main() {
          vec2 uv = vUv;

          // Aplicar distorsión del touch texture
          vec4 touchTex = texture2D(uTouchTexture, uv);
          float vx = -(touchTex.r * 2.0 - 1.0);
          float vy = -(touchTex.g * 2.0 - 1.0);
          float intensity = touchTex.b;
          uv.x += vx * 0.2 * intensity;
          uv.y += vy * 0.2 * intensity;

          // Efecto de onda
          vec2 center = vec2(0.5);
          float dist = length(uv - center);
          float wave = sin(dist * 10.0 - uTime * 2.0) * 0.02 * intensity;
          uv += vec2(wave);

          vec3 color = getGradientColor(uv, uTime);

          // Aplicar efecto de grano
          float grainValue = grain(uv, uTime);
          color += grainValue * uGrainIntensity;

          // Cambio de color sutil
          color.r += sin(uTime * 0.5) * 0.02;
          color.g += cos(uTime * 0.7) * 0.02;
          color.b += sin(uTime * 0.6) * 0.02;

          // Limitar a rango válido
          color = clamp(color, vec3(0.0), vec3(1.0));

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = 0;
    this.sceneManager.scene.add(this.mesh);
  }

  update(delta) {
    if (this.uniforms.uTime) {
      this.uniforms.uTime.value += delta;
    }
  }

  onResize(width, height) {
    const viewSize = this.sceneManager.getViewSize();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(
        viewSize.width,
        viewSize.height,
        1,
        1
      );
    }
    if (this.uniforms.uResolution) {
      this.uniforms.uResolution.value.set(width, height);
    }
  }
}

// App class - clase principal
class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Buscar el contenedor - puede ser webGLApp o gradient-background
    const container = document.getElementById("webGLApp") || document.getElementById("gradient-background");
    if (container) {
      container.appendChild(this.renderer.domElement);
    } else {
      document.body.appendChild(this.renderer.domElement);
    }

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.z = 50;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e40af); // Azul profundo

    this.clock = new THREE.Clock();
    this.touchTexture = new TouchTexture();
    this.gradientBackground = new GradientBackground(this);
    this.gradientBackground.uniforms.uTouchTexture.value = this.touchTexture.texture;

    this.init();
  }

  init() {
    this.gradientBackground.init();
    this.render();
    this.tick();
    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (ev) => this.onMouseMove(ev));
    window.addEventListener("touchmove", (ev) => this.onTouchMove(ev));
  }

  onTouchMove(ev) {
    const touch = ev.touches[0];
    this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  onMouseMove(ev) {
    this.mouse = {
      x: ev.clientX / window.innerWidth,
      y: 1 - ev.clientY / window.innerHeight
    };
    this.touchTexture.addTouch(this.mouse);
  }

  getViewSize() {
    const fovInRadians = (this.camera.fov * Math.PI) / 180;
    const height = Math.abs(
      this.camera.position.z * Math.tan(fovInRadians / 2) * 2
    );
    return { width: height * this.camera.aspect, height };
  }

  update(delta) {
    this.touchTexture.update();
    this.gradientBackground.update(delta);
  }

  render() {
    const delta = this.clock.getDelta();
    const clampedDelta = Math.min(delta, 0.1);
    this.update(clampedDelta);
    this.renderer.render(this.scene, this.camera);
  }

  tick() {
    this.render();
    requestAnimationFrame(() => this.tick());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.gradientBackground.onResize(window.innerWidth, window.innerHeight);
  }
}

// Iniciar la aplicación de forma optimizada
let app;
let initAttempts = 0;
const maxInitAttempts = 50; // Máximo 5 segundos de espera

function initGradientBackground() {
  if (typeof THREE !== 'undefined') {
    try {
      app = new App();

      // Forzar render inicial
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          if (app) app.render();
        });
      } else {
        // Usar requestAnimationFrame para mejor rendimiento
        requestAnimationFrame(() => {
          if (app) app.render();
        });
      }
    } catch (error) {
      console.warn('Error al inicializar fondo animado:', error);
    }
  } else {
    // Reintentar si Three.js aún no está cargado
    initAttempts++;
    if (initAttempts < maxInitAttempts) {
      setTimeout(initGradientBackground, 100);
    } else {
      console.warn('Three.js no se pudo cargar después de varios intentos.');
    }
  }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGradientBackground);
} else {
  initGradientBackground();
}

