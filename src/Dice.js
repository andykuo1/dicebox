function createGeometry(vertices, faces, radius, tab, af)
{
    var vectors = new Array(vertices.length);
    for (var i = 0; i < vertices.length; ++i)
    {
        vectors[i] = (new THREE.Vector3).fromArray(vertices[i]).normalize();
    }

    function make_geom(vertices, faces, radius, tab, af)
    {
        var geom = new THREE.Geometry();
        for (var i = 0; i < vertices.length; ++i) {
            var vertex = vertices[i].multiplyScalar(radius);
            vertex.index = geom.vertices.push(vertex) - 1;
        }
        for (var i = 0; i < faces.length; ++i) {
            var ii = faces[i], fl = ii.length - 1;
            var aa = Math.PI * 2 / fl;
            for (var j = 0; j < fl - 2; ++j) {
                geom.faces.push(
                    new THREE.Face3(ii[0], ii[j + 1], ii[j + 2], [geom.vertices[ii[0]],
                        geom.vertices[ii[j + 1]], geom.vertices[ii[j + 2]]], 0, ii[fl] + 1));
                geom.faceVertexUvs[0].push([
                    new THREE.Vector2((Math.cos(af) + 1 + tab) / 2 / (1 + tab),
                        (Math.sin(af) + 1 + tab) / 2 / (1 + tab)),
                    new THREE.Vector2((Math.cos(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab),
                        (Math.sin(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab)),
                    new THREE.Vector2((Math.cos(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab),
                        (Math.sin(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab))]);
            }
        }
        geom.computeFaceNormals();
        // Calculate bounding sphere here, cause it is faster.
        geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
        return geom;
    }

    var geom = make_geom(vectors, faces, radius, tab, af);
    return geom;
}

function toShape(geometry)
{
    const vertices = geometry.vertices.map((v) => {
        return new CANNON.Vec3(v.x, v.y, v.z);
    });
    const faces = geometry.faces.map((f) => {
        return [f.a, f.b, f.c];
    });
    return new CANNON.ConvexPolyhedron(vertices, faces);
}

function createMaterial(labels, size, margin, textureFunction = createTexture)
{
    var materials = [];
    for (var i = 0; i < labels.length; ++i)
    {
        const texture = textureFunction(labels[i], size, margin);
        materials.push(new THREE.MeshBasicMaterial({ map: texture }))
    }
    return materials;
}

function calculateTextureSize(approx) {
    return Math.max(128, Math.pow(2, Math.floor(Math.log(approx) / Math.log(2))));
}

function createTexture(text, size, margin)
{
    const background = 'black';
    const color = 'white';

    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    let textureSize = calculateTextureSize(size / 2 + size * margin) * 2;
    canvas.width = canvas.height = textureSize;
    context.font = textureSize / (1 + 2 * margin) + "pt Arial";
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    let texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

class Dice
{
    static loadResources()
    {
        this.FaceLabel = [' ', '0', '1', '2', '3', '4', '5', '6.', '7', '8',
        '9.', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
        this.Material = createMaterial(this.FaceLabel, 8, 1.0);
    }

    constructor(faceCount, geometry, material = Dice.Material, invertUp = false)
    {
        this.faceCount = faceCount;
        this.invertUp = invertUp;

        if (typeof geometry === 'function')
        {
            this.geometry = geometry.call(this);
        }
        else
        {
            this.geometry = geometry;
        }

        if (typeof material === 'function')
        {
            this.material = material.call(this);
        }
        else
        {
            this.material = material;
        }

        this.shape = toShape(this.geometry);
    }

    changeFaces(entity, fromFaceIndex, toFaceIndex)
    {
        const geometry = entity.geometry.clone();

        for (let i = 0, l = geometry.faces.length; i < l; ++i) {
            let materialIndex = geometry.faces[i].materialIndex;
            if (materialIndex === 0) continue;

            materialIndex += toFaceIndex - fromFaceIndex - 1;
            while (materialIndex > this.faceCount) materialIndex -= this.faceCount;
            while (materialIndex < 1) materialIndex += this.faceCount;

            geometry.faces[i].materialIndex = materialIndex + 1;
        }

        entity.mesh.geometry = geometry;
    }
}

class Dice4 extends Dice
{
    static loadResources()
    {
        this.FaceLabel = [
            [[], [0, 0, 0], [2, 4, 3], [1, 3, 4], [2, 1, 4], [1, 2, 3]],
            [[], [0, 0, 0], [2, 3, 4], [3, 1, 4], [2, 4, 1], [3, 2, 1]],
            [[], [0, 0, 0], [4, 3, 2], [3, 4, 1], [4, 2, 1], [3, 1, 2]],
            [[], [0, 0, 0], [4, 2, 3], [1, 4, 3], [4, 1, 2], [1, 3, 2]]
        ];

        const size = 8;
        const margin = 1.0;

        this.Material = [
            createMaterial(this.FaceLabel[0], size, margin, createD4Texture),
            createMaterial(this.FaceLabel[1], size, margin, createD4Texture),
            createMaterial(this.FaceLabel[2], size, margin, createD4Texture),
            createMaterial(this.FaceLabel[3], size, margin, createD4Texture)
        ];

        function createD4Texture(text, size)
        {
            const background = 'black';
            const color = 'white';
        
            let canvas = document.createElement("canvas");
            let context = canvas.getContext("2d");
            let ts = calculateTextureSize(size / 2 + size * 2) * 2;
            canvas.width = canvas.height = ts;
            context.font = ts / 5 + "pt Arial";
            context.fillStyle = background;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = color;
            for (let i in text)
            {
                context.fillText(text[i], canvas.width / 2,
                    canvas.height / 2 - ts * 0.3);
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(Math.PI * 2 / 3);
                context.translate(-canvas.width / 2, -canvas.height / 2);
            }
            let texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }

        this.Geometry = createGeometry(
            [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]],
            [[1, 0, 2, 1], [0, 1, 3, 2], [0, 3, 2, 3], [1, 2, 3, 4]],
            1.0, -0.1, Math.PI * 7 / 6
        );
    }

    constructor()
    {
        super(4, Dice4.Geometry, Dice4.Material[0], true);
    }

    /** @override */
    changeFaces(entity, fromFaceIndex, toFaceIndex)
    {
        const geometry = entity.geometry.clone();
        let offset = toFaceIndex - fromFaceIndex;
        for (let i = 0, l = geometry.faces.length; i < l; ++i) {
            let materialIndex = geometry.faces[i].materialIndex;
            if (materialIndex === 0) continue;
    
            materialIndex += offset - 1;
            while (materialIndex > this.faceCount) materialIndex -= this.faceCount;
            while (materialIndex < 1) materialIndex += this.faceCount;
    
            geometry.faces[i].materialIndex = materialIndex + 1;
        }
    
        if (offset != 0) {
            if (offset < 0) offset += 4;
            entity.mesh.material = Dice4.Material[offset];
            entity.mesh.needsUpdate = true;
        }

        entity.mesh.geometry = geometry;
    }
};

Dice.loadResources();
Dice4.loadResources();

export const D4 = new Dice4();
export const D6 = new Dice(6,
    createGeometry(
        [
            [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
        ],
        [
            [0, 3, 2, 1, 1], [1, 2, 6, 5, 2], [0, 1, 5, 4, 3],
            [3, 7, 6, 2, 4], [0, 4, 7, 3, 5], [4, 5, 6, 7, 6]
        ], 1.0, 0.1, Math.PI / 4
    ));
export const D8 = new Dice(8,
    createGeometry(
        [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
        ],
        [
            [0, 2, 4, 1], [0, 4, 3, 2], [0, 3, 5, 3], [0, 5, 2, 4], [1, 3, 4, 5],
            [1, 4, 2, 6], [1, 2, 5, 7], [1, 5, 3, 8]
        ],
        1.0, 0.1, -Math.PI / 4 / 2
    ));
export const D10 = new Dice(10,
    () => {
        var a = Math.PI * 2 / 10, k = Math.cos(a), h = 0.105, v = -1;
        var vertices = [];
        for (var i = 0, b = 0; i < 10; ++i, b += a)
            vertices.push([Math.cos(b), Math.sin(b), h * (i % 2 ? 1 : -1)]);
        vertices.push([0, 0, -1]); vertices.push([0, 0, 1]);
        var faces = [[5, 7, 11, 0], [4, 2, 10, 1], [1, 3, 11, 2], [0, 8, 10, 3], [7, 9, 11, 4],
                [8, 6, 10, 5], [9, 1, 11, 6], [2, 0, 10, 7], [3, 5, 11, 8], [6, 4, 10, 9],
                [1, 0, 2, v], [1, 2, 3, v], [3, 2, 4, v], [3, 4, 5, v], [5, 4, 6, v],
                [5, 6, 7, v], [7, 6, 8, v], [7, 8, 9, v], [9, 8, 0, v], [9, 0, 1, v]];
        return createGeometry(vertices, faces, 1.0, 0, Math.PI * 6 / 5);
    });
export const D12 = new Dice(12,
    () => {
        var p = (1 + Math.sqrt(5)) / 2, q = 1 / p;
        var vertices = [[0, q, p], [0, q, -p], [0, -q, p], [0, -q, -p], [p, 0, q],
                [p, 0, -q], [-p, 0, q], [-p, 0, -q], [q, p, 0], [q, -p, 0], [-q, p, 0],
                [-q, -p, 0], [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1],
                [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];
        var faces = [[2, 14, 4, 12, 0, 1], [15, 9, 11, 19, 3, 2], [16, 10, 17, 7, 6, 3], [6, 7, 19, 11, 18, 4],
                [6, 18, 2, 0, 16, 5], [18, 11, 9, 14, 2, 6], [1, 17, 10, 8, 13, 7], [1, 13, 5, 15, 3, 8],
                [13, 8, 12, 4, 5, 9], [5, 4, 14, 9, 15, 10], [0, 12, 8, 10, 16, 11], [3, 19, 7, 17, 1, 12]];
        return createGeometry(vertices, faces, 1.0, 0.2, -Math.PI / 4 / 2);
    });
export const D20 = new Dice(20,
    () => {
        var t = (1 + Math.sqrt(5)) / 2;
        var vertices = [[-1, t, 0], [1, t, 0 ], [-1, -t, 0], [1, -t, 0],
                [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
                [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
        var faces = [[0, 11, 5, 1], [0, 5, 1, 2], [0, 1, 7, 3], [0, 7, 10, 4], [0, 10, 11, 5],
                [1, 5, 9, 6], [5, 11, 4, 7], [11, 10, 2, 8], [10, 7, 6, 9], [7, 1, 8, 10],
                [3, 9, 4, 11], [3, 4, 2, 12], [3, 2, 6, 13], [3, 6, 8, 14], [3, 8, 9, 15],
                [4, 9, 5, 16], [2, 4, 11, 17], [6, 2, 10, 18], [8, 6, 7, 19], [9, 8, 1, 20]];
        return createGeometry(vertices, faces, 1.0, -0.2, -Math.PI / 4 / 2);
    });