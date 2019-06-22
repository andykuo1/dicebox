import { Entity, getEntityByName, updateEntities, getEntities } from './Entity.js';
import Random from './Random.js';

const TIME_STEP = 1 / 60;
var TICKS = 0;
var WORLD;
var SCENE;
var RENDERER;
var CAMERA;
var RANDOM = new Random();

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

    const diceMaterial = new CANNON.Material();
    Entity('dice',
        new THREE.BoxGeometry(1, 1, 1),
        createDiceMaterial([1, 2, 3, 4, 5, 6]),
        new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
        { mass: 1, material: diceMaterial })
        .on('create', function() {
            this.body.angularDamping = 0.5;
            this.body.position.set(0, 0, 5);
            applyRandomForce(this);
        })
        .create(SCENE, WORLD);
    
    const boundaryMaterial = new CANNON.Material();
    const boundaryGeometry = new THREE.PlaneGeometry(10, 10, 2, 2);
    const boundaryShape = new CANNON.Plane();
    const boundaryOpts = { mass: 0, material: boundaryMaterial };
    Entity('ground',
        boundaryGeometry,
        undefined,
        boundaryShape,
        boundaryOpts)
        .create(SCENE, WORLD);

    Entity('boundary-bottom',
        boundaryGeometry,
        undefined,
        boundaryShape,
        boundaryOpts)
        .on('create', function() {
            this.body.position.set(0, -5, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        })
        .create(SCENE, WORLD);
    
    Entity('boundary-top',
        boundaryGeometry,
        undefined,
        boundaryShape,
        boundaryOpts)
        .on('create', function() {
            this.body.position.set(0, 5, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        })
        .create(SCENE, WORLD);
    
    Entity('boundary-left',
        boundaryGeometry,
        undefined,
        boundaryShape,
        boundaryOpts)
        .on('create', function() {
            this.body.position.set(-5, 0, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
        })
        .create(SCENE, WORLD);
    
    Entity('boundary-right',
        boundaryGeometry,
        undefined,
        boundaryShape,
        boundaryOpts)
        .on('create', function() {
            this.body.position.set(5, 0, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
        })
        .create(SCENE, WORLD);
    
    const diceBoundaryMaterial = new CANNON.ContactMaterial(boundaryMaterial, diceMaterial, { friction: 0.0, restitution: 1.0 });
    WORLD.addContactMaterial(diceBoundaryMaterial);

    const dice = getEntityByName('dice');
    rollToFace(dice, Math.floor(Math.random() * 6));
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

function resetDice(entity)
{
    entity.body.position.set(0, 0, 5);
    entity.body.quaternion.set(0, 0, 0, 1);
    entity.body.velocity.set(0, 0, 0);
    entity.body.angularVelocity.set(0, 0, 0);
    applyRandomForce(entity);
}

function roll(entity, seed)
{
    TICKS = 0;
    RANDOM.setSeed(seed);
    resetDice(entity);
    while(!isStopped(entity) && TICKS < 1000)
    {
        updatePhysics();
    }
    return getNumberFace(entity);
}

function rollToFace(entity, faceValue)
{
    console.log(`Rolling ${faceValue}...`);
    const seed = Math.floor(Math.random() * 2147483647);
    const predictedFaceValue = roll(entity, seed);
    changeDiceFaces(entity, predictedFaceValue, faceValue);
    TICKS = 0;
    RANDOM.setSeed(seed);
    resetDice(entity);
}

function changeDiceFaces(entity, currentFaceValue, targetFaceValue)
{
    const newGeometry = entity.geometry.clone();
    const newFaces = newGeometry.faces;
    const currentFaceIndex = currentFaceValue * 2;
    const targetFaceIndex = targetFaceValue * 2;
    const currentMaterialIndex = newFaces[currentFaceIndex].materialIndex;
    const targetMaterialIndex = newFaces[targetFaceIndex].materialIndex;
    newFaces[currentFaceIndex].materialIndex = newFaces[currentFaceIndex + 1].materialIndex = targetMaterialIndex;
    newFaces[targetFaceIndex].materialIndex = newFaces[targetFaceIndex + 1].materialIndex = currentMaterialIndex;
    entity.mesh.geometry = newGeometry;
}

function createDiceMaterial(faceLabels)
{
    const result = [];
    for(let i = 0; i < faceLabels.length; ++i)
    {
        const label = faceLabels[i];
        const canvasElement = document.createElement('canvas');
        const canvasContext = canvasElement.getContext('2d');
        const size = 32;
        canvasElement.width = canvasElement.height = size;
        // Draw background
        canvasContext.fillStyle = 'black';
        canvasContext.fillRect(0, 0, canvasElement.width, canvasElement.height);
        // Draw label
        canvasContext.font = '24px monospace';
        canvasContext.textAlign = 'center';
        canvasContext.textBaseline = 'middle';
        canvasContext.fillStyle = 'white';
        canvasContext.fillText(label, canvasElement.width / 2, canvasElement.height / 2);
        // Add the little dot to distinguish 6 or 9.
        if (label === 6 || label == 9) {
            canvasContext.fillText(' .', canvasElement.width / 2, canvasElement.height / 2);
        }
        const texture = new THREE.Texture(canvasElement);
        texture.needsUpdate = true;
        result.push(new THREE.MeshBasicMaterial({ map: texture }))
    }
    return result;
}

function applyRandomForce(entity)
{
    const dx = RANDOM.nextFloat() * 20 - 10;
    const dy = RANDOM.nextFloat() * 20 - 10;
    const dz = -RANDOM.nextFloat() * 10;
    entity.body.angularVelocity = new CANNON.Vec3(dx, dy, dz);
    entity.body.velocity = new CANNON.Vec3(dx, dy, dz);
}

function getNumberFace(entity)
{
    const normalVector = new THREE.Vector3(0, 0, 1);
    let closestFace, closestRadians = Math.PI * 2;
    for(let i = 0, length = entity.geometry.faces.length; i < length; ++i)
    {
        const face = entity.geometry.faces[i];
        const radians = face.normal.clone().applyQuaternion(entity.body.quaternion).angleTo(normalVector);
        if (radians < closestRadians)
        {
            closestRadians = radians;
            closestFace = face;
        }
    }

    let closestMaterialIndex = closestFace.materialIndex;
    return closestMaterialIndex;
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