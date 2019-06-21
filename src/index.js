const TIME_STEP = 1 / 60;
var WORLD;
var SCENE;
var RENDERER;
var CAMERA;

const ENTITIES = new Map();
function createEntity(name, geometry, material, shape, mass)
{
    if (ENTITIES.has(name))
    {
        const oldEntity = ENTITIES.get(name);
        WORLD.removeBody(oldEntity.body);
        SCENE.remove(oldEntity.mesh);
    }

    const newEntity = {
        geometry,
        material,
        shape,
        mesh: new THREE.Mesh(geometry, material),
        body: new CANNON.Body({ mass, shape })
    };
    ENTITIES.set(name, newEntity);
    SCENE.add(mesh);
    WORLD.addBody(body);
    return newEntity;
}

function getEntityByName(name)
{
    return ENTITIES.get(name);
}

var geometry, material, mesh;
var groundGeometry, groundMaterial, groundMesh;

var shape, body;
var groundShape, groundBody;

init();
animate();

function initThree()
{
    SCENE = new THREE.Scene();

    CAMERA = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    CAMERA.position.z = 5;
    SCENE.add(CAMERA);

    RENDERER = new THREE.WebGLRenderer();
    RENDERER.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(RENDERER.domElement);

    // RENDERER.shadowMap.enabled = true;
    // RENDERER.shadowMap.type = THREE.PCFShadowMap;
    // RENDERER.setClearColor(0xFFFFFF, 1);
}

function initCannon()
{
    WORLD = new CANNON.World();
    WORLD.gravity.set(0, 0, -9.82);
    WORLD.broadphase = new CANNON.NaiveBroadphase();
    WORLD.solver.iterations = 10;

    shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    body = new CANNON.Body({ mass: 1, shape: shape });
    body.angularVelocity = new CANNON.Vec3(Math.random() * 30 - 15, Math.random() * 30 - 15, Math.random() * 30 - 15);
    body.angularDamping = 0.5;
    body.position.set(0, 0, 4);
    WORLD.addBody(body);

    groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.position.set(0, 0, 0);
    groundBody.quaternion.setFromEuler(0, Math.PI / 4, 0);
    WORLD.add(groundBody);
}

function init()
{
    initThree();
    initCannon();
    
    geometry = new THREE.BoxGeometry(1, 1, 1);
    material = undefined; //new THREE.MeshBasicMaterial({ color: 0x00FF00 });
    mesh = new THREE.Mesh(geometry, material);
    SCENE.add(mesh);

    groundGeometry = new THREE.PlaneGeometry(8, 8, 1, 1);
    groundMaterial = undefined; //new THREE.MeshBasicMaterial({ color: 0x662200 });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    SCENE.add(groundMesh);
}

function animate()
{
    requestAnimationFrame(animate);
    updatePhysics();
    renderScene();
}

function updatePhysics()
{
    WORLD.step(TIME_STEP);

    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);

    groundMesh.position.copy(groundBody.position);
    groundMesh.quaternion.copy(groundBody.quaternion);
}

function renderScene()
{
    RENDERER.render(SCENE, CAMERA);
}