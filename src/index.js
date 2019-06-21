const TIME_STEP = 1 / 60;
var WORLD;
var SCENE;
var RENDERER;
var CAMERA;

const ENTITIES = new Map();
function Entity(name, geometry, material, shape, opts = {}, callback = null)
{
    // Replace any existing entity of the same name...
    if (ENTITIES.has(name))
    {
        ENTITIES.get(name).destroy();
    }

    // Create new entity object...
    const newEntity = {
        geometry,
        material,
        shape,
        opts,
        mesh: new THREE.Mesh(geometry, material),
        body: new CANNON.Body({ mass: opts.mass || 0, shape }),
        _eventListeners: new Map(),
        _eventCache: [],
        _useCache: false,
        create()
        {
            SCENE.add(this.mesh);
            WORLD.addBody(this.body);

            this.emit('create');

            return this;
        },
        update()
        {
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);

            this.emit('update');

            return this;
        },
        destroy()
        {
            this.emit('destroy');

            WORLD.removeBody(this.body);
            SCENE.remove(this.mesh);

            return this;
        },
        emit(eventName, ...args)
        {
            if (this._eventListeners.has(eventName))
            {
                this._useCache = true;
                for(const eventListener of this._eventListeners.get(eventName))
                {
                    eventListener.call(this, ...args);
                }
                this._useCache = false;

                // Process the cache
                while(this._eventCache.length > 0)
                {
                    const event = this._eventCache.shift();
                    switch(event.type)
                    {
                        case 'create':
                            this.on(event.name, event.callback);
                            break;
                        case 'delete':
                            this.off(event.name, event.callback);
                            break;
                    }
                }
            }

            return this;
        },
        on(eventName, callback)
        {
            if (this._useCache)
            {
                this._eventCache.push({ type: 'create', name: eventName, callback });
            }
            else if (this._eventListeners.has(eventName))
            {
                this._eventListeners.get(eventName).push(callback);
            }
            else
            {
                this._eventListeners.set(eventName, [ callback ]);
            }

            return this;
        },
        off(eventName, callback)
        {
            if (this._useCache)
            {
                this._eventCache.push({ type: 'delete', name: eventName, callback });
            }
            else if (this._eventListeners.has(eventName))
            {
                const listeners = this._eventListeners.get(eventName);
                listeners.splice(listeners.indexOf(callback), 1);
            }
            else
            {
                // It doesn't exist...
            }

            return this;
        },
        once(eventName, callback)
        {
            const wrapper = function()
            {
                callback.call(this);
                this.off(eventName, wrapper);
            };
            this.on(eventName, wrapper);

            return this;
        }
    };
    ENTITIES.set(name, newEntity);

    return newEntity;
}

function getEntityByName(name)
{
    return ENTITIES.get(name);
}

function updateEntities(entities)
{
    for(const entity of entities)
    {
        entity.update();
    }
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
        .create();

    groundGeometry = new THREE.PlaneGeometry(8, 8, 1, 1);
    groundMaterial = undefined; //new THREE.MeshBasicMaterial({ color: 0x662200 });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    SCENE.add(groundMesh);

    groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.position.set(0, 0, 0);
    groundBody.quaternion.setFromEuler(0, Math.PI / 4, 0);
    WORLD.addBody(groundBody);
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

    updateEntities(ENTITIES.values());

    groundMesh.position.copy(groundBody.position);
    groundMesh.quaternion.copy(groundBody.quaternion);
}

function renderScene()
{
    RENDERER.render(SCENE, CAMERA);
}