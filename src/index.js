import { Entity, getEntityByName, updateEntities, getEntities } from './Entity.js';
import Random from './Random.js';
import { D4, D6, D8, D10, D12, D20 } from './Dice.js';

const DICE_SHAPE_MATERIAL = new CANNON.Material();
const BOUNDARY_SHAPE_MATERIAL = new CANNON.Material();
const BOUNDARY_SIZE = 10;
const MAX_SIMULATION_TICKS = 10000;

class DiceBox
{
    constructor()
    {
        this._dice = [];
        this._nextDiceID = 0;
        this._locked = false;
        this._stopped = false;
        this._outcome = [];

        this.run = this.run.bind(this);
    }

    init()
    {
        this._createBoundaryBox(BOUNDARY_SIZE);

        const diceBoundaryMaterial = new CANNON.ContactMaterial(BOUNDARY_SHAPE_MATERIAL, DICE_SHAPE_MATERIAL, { friction: 0.4, restitution: 0.3 });
        const diceDiceMaterial = new CANNON.ContactMaterial(DICE_SHAPE_MATERIAL, DICE_SHAPE_MATERIAL, { friction: 0.01, restitution: 0.5 });
        WORLD.addContactMaterial(diceBoundaryMaterial);
        WORLD.addContactMaterial(diceDiceMaterial);
    }

    start(predicted = false)
    {
        if (this._locked) return;

        this._stopped = false;
        this._outcome.length = 0;

        // Lock any changes...
        this._locked = true;
        const dice = this._dice;
        const seed = Math.floor(Math.random() * 2147483647);

        if (predicted)
        {
            // Pre-compute outcomes
            const outcomeValues = this._outcome;
            for(const die of dice)
            {
                outcomeValues.push(Math.floor(Math.random() * die.diceType.faceCount) + 1);
            }

            console.log(`Rolling ${outcomeValues.join('+')}...`);

            // Restart simulation at the beginning...
            this.prepare(RANDOM, seed);
            
            // Simulate a roll first...
            const predictedValues = [];

            let running = true;
            while (running && TICKS < MAX_SIMULATION_TICKS)
            {
                updatePhysics();

                // Check if everything stopped...
                if (this.hasDiceStopped())
                {
                    running = false;
                }
            }
            
            // Result from die rolls
            this.getCurrentDiceOutcome(predictedValues);

            // Then change the roll to match the generated outcome...
            for (let i = 0; i < dice.length; ++i)
            {
                const die = dice[i];
                const outcomeValue = outcomeValues[i];
                const predictedValue = predictedValues[i];
                // Get the face index (which starts from 0) of the values...
                die.diceType.changeFaces(die, predictedValue - 1, outcomeValue - 1);
            }

            // Restart simulation at the beginning again...
            this.prepare(RANDOM, seed);

            // Actually run it this time...
        }
        else
        {
            // Just run it normally...
            this.prepare(RANDOM, seed);
        }
        
        this.onDiceThrow();

        // Just to make sure everything looks okay first...
        renderScene();

        // Now run it.
        return this.run();
    }

    continue()
    {
        if (this._locked) return;

        this._stopped = false;
        this._outcome.length = 0;

        // Lock any changes...
        this._locked = true;

        // Just to make sure everything looks okay first...
        renderScene();

        // Now run it.
        return this.run();
    }

    prepare(rand, seed)
    {
        this.reset();
        TICKS = 0;
        rand.setSeed(seed);
        this.applyThrow(rand);
    }

    run()
    {
        return new Promise((resolve, reject) => {
            if (this._stopped || this.hasDiceStopped())
            {
                this._locked = false;
                this.onDiceStopped();
                resolve(this);
            }
            else
            {
                requestAnimationFrame(this.run);
                updatePhysics();
                renderScene();
            }
        });
    }

    stop()
    {
        this._stopped = true;
        this._locked = false;
    }

    reset()
    {
        for (const die of this._dice)
        {
            die.body.position.set(0, 0, 0);
            die.body.quaternion.set(0, 0, 0, 1);
            die.body.velocity.set(0, 0, 0);
            die.body.angularVelocity.set(0, 0, 0);
        }
    }

    onDiceThrow()
    {
        const title = document.querySelector('#title');
        title.textContent = '???';
    }

    onDiceStopped()
    {
        if (this._outcome.length <= 0)
        {
            // Result from die rolls
            this.getCurrentDiceOutcome(this._outcome);
        }

        const title = document.querySelector('#title');
        if (this._outcome.length > 0)
        {
            const totalValue = this.getTotalDiceValue();
            title.textContent = totalValue;
        }
        else
        {
            title.textContent = '0';
        }
    }

    applyThrow(rand)
    {
        const diceCount = this._dice.length;
        const halfDiceCount = diceCount / 2;
        for (const die of this._dice)
        {
            die.body.position.set(
                rand.nextFloat() * diceCount - halfDiceCount,
                rand.nextFloat() * diceCount - halfDiceCount,
                0);
            applyRandomForce(rand, die);
        }
    }
    
    getTotalDiceValue()
    {
        // Result from die rolls
        let result = 0;
        for (const outcome of this._outcome)
        {
            // Outcomes contain face indices, which start from 0.
            result += outcome;
        }
        return result;
    }

    getCurrentDiceOutcome(dst = [])
    {
        // Result from die rolls
        for (const die of this._dice)
        {
            dst.push(getUpFace(die, die.diceType === D4) + 1);
        }
        return dst;
    }

    addDice(...diceTypes)
    {
        if (this._locked) return;

        for(const diceType of diceTypes)
        {
            this._dice.push(this._createDice(diceType));
        }
    }

    removeDice(...diceTypes)
    {
        if (this._locked) return;
        
        for(let i = this._dice.length - 1; i >= 0; --i)
        {
            const die = this._dice[i];
            const j = diceTypes.indexOf(die.diceType);
            if (j >= 0)
            {
                this._dice.splice(i, 1);
                diceTypes.splice(j, 1);
                die.destroy();
            }
        }
    }

    clearDice(...diceTypes)
    {
        if (this._locked) return;

        for(let i = this._dice.length - 1; i >= 0; --i)
        {
            const die = this._dice[i];
            if (diceTypes.includes(die.diceType))
            {
                this._dice.splice(i, 1);
                die.destroy();
            }
        }
    }

    countDice(diceType)
    {
        let i = 0;
        for(const die of this._dice)
        {
            if (die.diceType === diceType)
            {
                ++i;
            }
        }
        return i;
    }

    hasDiceStopped()
    {
        for (const die of this._dice)
        {
            if (!isStopped(die))
            {
                return false;
            }
        }
        return true;
    }

    _createDice(diceType)
    {
        return Entity('dice' + (this._nextDiceID++),
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
            .create(SCENE, WORLD);
    }

    _createBoundaryBox(size)
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
}

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
var DICE_BOX = new DiceBox();

init();

function initInput()
{
    CONTAINER_ELEMENT = document.querySelector('#container');
    document.querySelector('canvas').addEventListener('click', (e) => {
        DICE_BOX.start(true);
    });
    document.querySelector('#option-button').addEventListener('click', (e) => {
        document.querySelector('nav').classList.toggle('show');
    });
    document.querySelector('#roll-button').addEventListener('click', (e) => {
        DICE_BOX.stop();
        DICE_BOX.start(true);
    });
    registerDiceButton(D4, 'd4');
    registerDiceButton(D6, 'd6');
    registerDiceButton(D8, 'd8');
    registerDiceButton(D10, 'd10');
    registerDiceButton(D12, 'd12');
    registerDiceButton(D20, 'd20');
}

function registerDiceButton(diceType, diceID)
{
    document.querySelector(`#${diceID} .add`).addEventListener('click', (e) => {
        DICE_BOX.stop();
        DICE_BOX.addDice(diceType);
        const count = DICE_BOX.countDice(diceType);
        if (count > 0)
        {
            document.querySelector(`#${diceID} .sub`).disabled = false;
            document.querySelector(`#${diceID} .clear`).disabled = false;
        }
        document.querySelector(`#${diceID} .amount`).textContent = count || '';
        DICE_BOX.continue();
    });
    document.querySelector(`#${diceID} .sub`).addEventListener('click', (e) => {
        DICE_BOX.stop();
        DICE_BOX.removeDice(diceType);
        const count = DICE_BOX.countDice(diceType);
        if (count <= 0)
        {
            document.querySelector(`#${diceID} .sub`).disabled = true;
            document.querySelector(`#${diceID} .clear`).disabled = true;
        }
        document.querySelector(`#${diceID} .amount`).textContent = count || '';
        DICE_BOX.continue();
    });
    document.querySelector(`#${diceID} .clear`).addEventListener('click', (e) => {
        DICE_BOX.stop();
        DICE_BOX.clearDice(diceType);
        document.querySelector(`#${diceID} .sub`).disabled = true;
        document.querySelector(`#${diceID} .clear`).disabled = true;
        document.querySelector(`#${diceID} .amount`).textContent = '';
        DICE_BOX.continue();
    });
}
registerDiceButton._timeout = null;

function initThree()
{
    SCENE = new THREE.Scene();

    CANVAS_ELEMENT = document.querySelector('canvas');
    const rect = CANVAS_ELEMENT.getBoundingClientRect();
    CAMERA = new THREE.PerspectiveCamera(40, rect.width / rect.height, 0.1, 100);
    CAMERA.position.z = 10;
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

function init()
{
    initInput();
    initThree();
    initCannon();

    DICE_BOX.init();
    DICE_BOX.start(false);
}

function updatePhysics()
{
    WORLD.step(TIME_STEP);
    ++TICKS;

    updateEntities(getEntities().values());
    updateInputs();
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

function renderScene()
{
    RENDERER.render(SCENE, CAMERA);
}

function isStopped(entity)
{
    const thresholdSq = 0.04;
    const angularVelocity = entity.body.angularVelocity;
    const velocity = entity.body.velocity;

    if (angularVelocity.lengthSquared() < thresholdSq
        && velocity.lengthSquared() < thresholdSq)
    {
        if (!entity._stopTicks || entity._stopTicks < 0)
        {
            entity._stopTicks = TICKS;
        }
        else if (TICKS - entity._stopTicks > 10)
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

function getUpFace(entity, invertUpFace)
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

    return closestFace.materialIndex - 1 - 1;
}

function applyRandomForce(rand, entity)
{
    const dx = rand.nextFloat() * 20 - 10;
    const dy = rand.nextFloat() * 20 - 10;
    const dz = -rand.nextFloat() * 10;
    entity.body.angularVelocity = new CANNON.Vec3(dx, dy, dz);
    entity.body.velocity = new CANNON.Vec3(dx, dy, dz);
}