const ENTITIES = new Map();

export function Entity(name, geometry, material, shape, opts = {})
{
    // Replace any existing entity of the same name...
    if (ENTITIES.has(name))
    {
        ENTITIES.get(name).destroy();
    }

    // Create new entity object...
    const newEntity = {
        scene: null,
        world: null,
        geometry,
        material,
        shape,
        opts,
        mesh: new THREE.Mesh(geometry, material),
        body: new CANNON.Body({ mass: opts.mass || 0, shape }),
        _eventListeners: new Map(),
        _eventCache: [],
        _useCache: false,
        create(scene, world)
        {
            scene.add(this.mesh);
            this.scene = scene;
            world.addBody(this.body);
            this.world = world;

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

            this.world.removeBody(this.body);
            this.scene.remove(this.mesh);

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

export function getEntityByName(name)
{
    return ENTITIES.get(name);
}

export function updateEntities(entities)
{
    for(const entity of entities)
    {
        entity.update();
    }
}

export function getEntities()
{
    return ENTITIES;
}
