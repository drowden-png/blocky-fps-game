const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 500);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(50, 50, 50);
light.castShadow = true;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// Player
const player = {
  pos: new THREE.Vector3(0, 5, 0),
  vel: new THREE.Vector3(0, 0, 0),
  speed: 0.3,
  health: 100,
  ammo: 30,
  maxAmmo: 30,
  kills: 0
};

// Camera controller
const keys = {};
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

let yaw = 0, pitch = 0;
window.addEventListener('mousemove', (e) => {
  yaw -= e.movementX * 0.005;
  pitch -= e.movementY * 0.005;
  pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
});

// Request pointer lock
document.addEventListener('click', () => renderer.domElement.requestPointerLock());

// Ground
const groundGeom = new THREE.BoxGeometry(200, 1, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x90ee90 });
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Buildings
function createBuilding(x, z, w, h, d, color) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, h/2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

createBuilding(30, 30, 20, 20, 20, 0xff6b6b);
createBuilding(-30, 40, 25, 15, 25, 0x4ecdc4);
createBuilding(0, 60, 30, 10, 15, 0xffe66d);
createBuilding(-50, -20, 15, 25, 20, 0x95e1d3);

// Enemy class
class Enemy {
  constructor(x, z) {
    this.pos = new THREE.Vector3(x, 5, z);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.speed = 0.1;
    this.health = 50;
    this.geom = new THREE.BoxGeometry(2, 4, 2);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(this.geom, this.mat);
    this.mesh.position.copy(this.pos);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(playerPos) {
    const dir = playerPos.clone().sub(this.pos).normalize();
    this.vel = dir.multiplyScalar(this.speed);
    this.pos.add(this.vel);
    this.mesh.position.copy(this.pos);
  }

  takeDamage(damage) {
    this.health -= damage;
    return this.health <= 0;
  }

  remove() {
    scene.remove(this.mesh);
  }
}

const enemies = [];
for (let i = 0; i < 5; i++) {
  enemies.push(new Enemy(Math.random() * 100 - 50, Math.random() * 100 - 50));
}

// Shooting
const bullets = [];
window.addEventListener('click', () => {
  if (player.ammo <= 0) return;
  player.ammo--;

  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  bullets.push({
    pos: camera.position.clone().add(dir.clone().multiplyScalar(5)),
    dir: dir.clone(),
    dist: 0,
    maxDist: 200
  });
});

// Reload
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') player.ammo = player.maxAmmo;
});

// Update HUD
function updateHUD() {
  document.getElementById('health').textContent = player.health;
  document.getElementById('kills').textContent = player.kills;
  document.getElementById('ammoCount').textContent = player.ammo;
}

// Game loop
function animate() {
  requestAnimationFrame(animate);

  // Player movement
  const moveDir = new THREE.Vector3();
  if (keys['w']) moveDir.z -= 1;
  if (keys['s']) moveDir.z += 1;
  if (keys['a']) moveDir.x -= 1;
  if (keys['d']) moveDir.x += 1;

  if (moveDir.length() > 0) {
    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    moveDir.multiplyScalar(player.speed);
    player.pos.add(moveDir);
    player.pos.x = Math.max(-95, Math.min(95, player.pos.x));
    player.pos.z = Math.max(-95, Math.min(95, player.pos.z));
  }

  camera.position.copy(player.pos);
  camera.position.y += 2;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Update enemies
  enemies.forEach((enemy, i) => {
    enemy.update(player.pos);
    const dist = enemy.pos.distanceTo(player.pos);
    if (dist < 2) player.health -= 0.5;
  });

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.pos.add(bullet.dir.clone().multiplyScalar(2));
    bullet.dist += 2;

    if (bullet.dist > bullet.maxDist) {
      bullets.splice(i, 1);
      continue;
    }

    // Check hit
    for (let j = enemies.length - 1; j >= 0; j--) {
      if (bullet.pos.distanceTo(enemies[j].pos) < 2) {
        if (enemies[j].takeDamage(25)) {
          enemies[j].remove();
          enemies.splice(j, 1);
          player.kills++;
          enemies.push(new Enemy(Math.random() * 100 - 50, Math.random() * 100 - 50));
        }
        bullets.splice(i, 1);
        break;
      }
    }
  }

  if (player.health <= 0) {
    alert('Game Over! Kills: ' + player.kills);
    location.reload();
  }

  updateHUD();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
