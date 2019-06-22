import { Entity, getEntityByName, updateEntities, getEntities } from './Entity.js';
import Random from './Random.js';
import { D4, D6, D8, D10, D12, D20 } from './Dice.js';

const TIME_STEP = 1 / 60;
var TICKS = 0;
var WORLD;
var SCENE;
var RENDERER;
var CAMERA;
var RANDOM = new Random();
const CONTAINER = { x: 0, y: 0, dx: 0, dy: 0, active: false };
var CONTAINER_ELEMENT;
var CANVAS_ELEMENT;

const DICE_SHAPE_MATERIAL = new CANNON.Material();
const BOUNDARY_SHAPE_MATERIAL = new CANNON.Material();

init();
animate();

function initInput()
{
    CONTAINER_ELEMENT = document.querySelector('#container');
}

function updateInputs()
{
    const containerRect = CONTAINER_ELEMENT.getBoundingClientRect();
    const x = (containerRect.left + window.screenX);
    const y = (containerRect.top + window.screenY);
    CONTAINER.dx = CONTAINER.x - x;
    CONTAINER.dy = CONTAINER.y - y;
    CONTAINER.x = x;
    CONTAINER.y = y;
}

function initThree()
{
    SCENE = new THREE.Scene();

    CANVAS_ELEMENT = document.querySelector('canvas');
    const rect = CANVAS_ELEMENT.getBoundingClientRect();
    CAMERA = new THREE.PerspectiveCamera(60, rect.width / rect.height, 0.1, 100);
    CAMERA.position.z = 5;
    SCENE.add(CAMERA);

    RENDERER = new THREE.WebGLRenderer({ canvas: CANVAS_ELEMENT });
    RENDERER.setSize(rect.width, rect.height);
}

function initCannon()
{
    WORLD = new CANNON.World();
    WORLD.gravity.set(0, 0, -9.82);
    WORLD.broadphase = new CANNON.NaiveBroadphase();
    WORLD.solver.iterations = 10;
}

function clamp(value, min, max)
{
    return Math.min(Math.max(value, min), max);
}

function createDice(diceTypes)
{
    const result = [];
    let id = 0;
    for (const diceType of diceTypes)
    {
        result.push(Entity('dice' + (id++),
            diceType.geometry,
            diceType.material,
            diceType.shape,
            {
                diceType,
                mass: 2,
                shapeMaterial: DICE_SHAPE_MATERIAL
            })
            .on('create', function ()
            {
                this.body.angularDamping = 0.5;
            })
            .on('update', function()
            {
                if (CONTAINER.active)
                {
                    this.body.velocity.x += CONTAINER.dx * 0.03;
                    this.body.velocity.y -= CONTAINER.dy * 0.03;
                }
            })
            .create(SCENE, WORLD));
    }
    return result;
}

function createBoundaryBox(size = 10)
{
    const boundaryGeometry = new THREE.PlaneGeometry(size, size, 2, 2);
    const boundaryMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const boundaryGroundMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const boundaryShape = new CANNON.Plane();
    const boundaryOpts = { mass: 0, shapeMaterial: BOUNDARY_SHAPE_MATERIAL };
    const result = [];
    const halfSize = size / 2;

    result.push(Entity('ground',
        boundaryGeometry,
        boundaryGroundMaterial,
        boundaryShape,
        boundaryOpts)
        .on('create', function()
        {
            this.body.position.set(0, 0, -halfSize);
        })
        .create(SCENE, WORLD));

    result.push(Entity('boundary-bottom',
        boundaryGeometry,
        boundaryMaterial,
        boundaryShape,
        boundaryOpts)
        .on('create', function ()
        {
            this.body.position.set(0, -halfSize, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        })
        .create(SCENE, WORLD));

    result.push(Entity('boundary-top',
        boundaryGeometry,
        boundaryMaterial,
        boundaryShape,
        boundaryOpts)
        .on('create', function ()
        {
            this.body.position.set(0, halfSize, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        })
        .create(SCENE, WORLD));

    result.push(Entity('boundary-left',
        boundaryGeometry,
        boundaryMaterial,
        boundaryShape,
        boundaryOpts)
        .on('create', function ()
        {
            this.body.position.set(-halfSize, 0, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
        })
        .create(SCENE, WORLD));

    result.push(Entity('boundary-right',
        boundaryGeometry,
        boundaryMaterial,
        boundaryShape,
        boundaryOpts)
        .on('create', function ()
        {
            this.body.position.set(halfSize, 0, 0);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
        })
        .create(SCENE, WORLD));

    return result;
}

function init()
{
    initInput();
    initThree();
    initCannon();

    const dice = createDice([D6, D6, D6, D6]);
    const boundaryBox = createBoundaryBox();

    const diceBoundaryMaterial = new CANNON.ContactMaterial(BOUNDARY_SHAPE_MATERIAL, DICE_SHAPE_MATERIAL, { friction: 0.4, restitution: 0.3 });
    const diceDiceMaterial = new CANNON.ContactMaterial(DICE_SHAPE_MATERIAL, DICE_SHAPE_MATERIAL, { friction: 0.01, restitution: 0.5 });
    WORLD.addContactMaterial(diceBoundaryMaterial);
    WORLD.addContactMaterial(diceDiceMaterial);

    rollForValues(dice, [1, 1, 1, 1]);
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
    updateInputs();
}

function renderScene()
{
    RENDERER.render(SCENE, CAMERA);
}

function resetDice(dice)
{
    const diceCount = dice.length;
    const halfDiceCount = diceCount / 2;
    for (const die of dice)
    {
        die.body.position.set(RANDOM.nextFloat() * diceCount - halfDiceCount, RANDOM.nextFloat() * diceCount - halfDiceCount, 0);
        die.body.quaternion.set(0, 0, 0, 1);
        die.body.velocity.set(0, 0, 0);
        die.body.angularVelocity.set(0, 0, 0);
        applyRandomForce(die);
    }
}

function rollForValues(dice, values)
{
    console.log(`Rolling ${values.join('+')}...`);
    const seed = Math.floor(Math.random() * 2147483647);
    const predictedValues = roll(dice, seed);
    for (let i = 0; i < dice.length; ++i)
    {
        const die = dice[i];
        const value = values[i];
        const predictedValue = predictedValues[i];
        die.diceType.changeFaces(die, predictedValue, value);
    }
    TICKS = 0;
    RANDOM.setSeed(seed);
    resetDice(dice);
}

function roll(dice, seed)
{
    TICKS = 0;
    RANDOM.setSeed(seed);
    resetDice(dice);
    let running = true;
    while (running && TICKS < 1000)
    {
        updatePhysics();

        // Check if everything stopped...
        let flag = false;
        for (const die of dice)
        {
            if (!isStopped(die))
            {
                flag = true;
                break;
            }
        }
        if (!flag) running = false;
    }

    // Result from die rolls
    const values = [];
    for (const die of dice)
    {
        values.push(getNumberFace(die, die.diceType === D4));
    }
    return values;
}

function applyRandomForce(entity)
{
    const dx = RANDOM.nextFloat() * 20 - 10;
    const dy = RANDOM.nextFloat() * 20 - 10;
    const dz = -RANDOM.nextFloat() * 10;
    entity.body.angularVelocity = new CANNON.Vec3(dx, dy, dz);
    entity.body.velocity = new CANNON.Vec3(dx, dy, dz);
}

function getNumberFace(entity, invertUpFace)
{
    const targetVector = new THREE.Vector3(0, 0, invertUpFace ? -1 : 1);
    let closestFace;
    let closestRadians = Math.PI * 2;
    for (let i = 0, length = entity.geometry.faces.length; i < length; ++i)
    {
        const face = entity.geometry.faces[i];
        if (face.materialIndex === 0) continue;

        const radians = face.normal.clone().applyQuaternion(entity.body.quaternion).angleTo(targetVector);
        if (radians < closestRadians)
        {
            closestRadians = radians;
            closestFace = face;
        }
    }

    return closestFace.materialIndex - 1;
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