import { Entity, getEntityByName, updateEntities, getEntities } from './Entity.js';

const TIME_STEP = 1 / 60;
var TICKS = 0;
var WORLD;
var SCENE;
var RENDERER;
var CAMERA;

init();
animate();

function initThree()
{
    SCENE = new THREE.Scene();

    CAMERA = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    CAMERA.position.z = 10;
    SCENE.add(CAMERA);

    RENDERER = new THREE.WebGLRenderer();
    RENDERER.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(RENDERER.domElement);
}

function initCannon()
{
    WORLD = new CANNON.World();
    WORLD.gravity.set(0, 0, -9.82);
    WORLD.broadphase = new CANNON.NaiveBroadphase();
    WORLD.solver.iterations = 10;
}

function init()
{
    initThree();
    initCannon();

    Entity('dice',
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x00FF00 }),
        new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
        { mass: 1 })
        .on('create', function() {
            this.body.angularVelocity = new CANNON.Vec3(Math.random() * 30 - 15, Math.random() * 30 - 15, Math.random() * 30 - 15);
            this.body.angularDamping = 0.5;
            this.body.position.set(0, 0, 4);
        })
        .on('update', function() {
            if (isStopped(this))
            {
                this.body.position.set(0, 0, 4);
                applyRandomForce(this);
            }
        })
        .create(SCENE, WORLD);

    const boundaryGeometry = new THREE.PlaneGeometry(10, 10, 2, 2);
    Entity('ground',
        boundaryGeometry,
        undefined,
        new CANNON.Plane(),
        { mass: 0 })
        .create(SCENE, WORLD);

    Entity('boundary-bottom',
        boundaryGeometry,
        undefined,
        new CANNON.Plane(),
        { mass: 0 })
        .on('create', function() {
            this.body.position.set(0, -5, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        })
        .create(SCENE, WORLD);
    
    Entity('boundary-top',
        boundaryGeometry,
        undefined,
        new CANNON.Plane(),
        { mass: 0 })
        .on('create', function() {
            this.body.position.set(0, 5, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        })
        .create(SCENE, WORLD);
    
    Entity('boundary-left',
        boundaryGeometry,
        undefined,
        new CANNON.Plane(),
        { mass: 0 })
        .on('create', function() {
            this.body.position.set(-5, 0, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
        })
        .create(SCENE, WORLD);
    
    Entity('boundary-right',
        boundaryGeometry,
        undefined,
        new CANNON.Plane(),
        { mass: 0 })
        .on('create', function() {
            this.body.position.set(5, 0, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
        })
        .create(SCENE, WORLD);
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
    ++TICKS;

    updateEntities(getEntities().values());
}

function renderScene()
{
    RENDERER.render(SCENE, CAMERA);
}

function applyRandomForce(entity)
{
    const dx = Math.random() * 20 - 10;
    const dy = Math.random() * 20 - 10;
    const dz = -Math.random() * 10;
    entity.body.angularVelocity = new CANNON.Vec3(dx, dy, dz);
    entity.body.velocity = new CANNON.Vec3(dx, dy, dz);
}

function isStopped(entity)
{
    const thresholdSq = 0.05;
    const angularVelocity = entity.body.angularVelocity;
    const velocity = entity.body.velocity;

    if (angularVelocity.lengthSquared() < thresholdSq
        && velocity.lengthSquared() < thresholdSq)
    {
        if (!entity._stopTicks || entity._stopTicks < 0)
        {
            entity._stopTicks = TICKS;
        }
        else if (TICKS - entity._stopTicks > 30)
        {
            return true;
        }
    }
    else
    {
        entity._stopTicks = -1;
    }

    return false;
}