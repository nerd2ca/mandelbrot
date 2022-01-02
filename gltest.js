"use strict"

var fragmentShaderSource = `
#version 100
precision highp float;
uniform float scale;
uniform vec2 centreIn;
uniform vec2 centreOut;
uniform sampler2D palette;
void main() {
    float x0 = centreIn.x + (gl_FragCoord.x - centreOut.x) / scale;
    float y0 = centreIn.y + (gl_FragCoord.y - centreOut.y) / scale;
    float ix = 0.0;
    float iy = 0.0;
    int c = -1;
    int max_iter = 128;
    for (int iter = 0; iter < 500; iter++) {
        if (c >= 0 || iter >= max_iter)
            continue;
        float ix2 = ix*ix;
        float iy2 = iy*iy;
        if (ix2 + iy2 > 4.0) {
            c = iter;
            continue;
        }
        float xnext = ix2 - iy2 + x0;
        iy = 2.0 * ix * iy + y0;
        ix = xnext;
    }
    if (c < 0)
        c = max_iter;
    gl_FragColor = texture2D(palette, vec2((float(c)+0.5)/float(max_iter), 0.5));
}
`

var vertexShaderSource = `
#version 100
precision highp float;
attribute vec3 pos;
void main() {
    gl_Position = vec4(pos, 1.0);
}
`

window.addEventListener("load", setupWebGL, false);
var gl,
    program,
    bufIndices,
    bufVertices,
    bufScale,
    bufCentreIn,
    bufCentreOut,
    canvas;
function setupWebGL (evt) {
    window.removeEventListener(evt.type, setupWebGL, false);
    canvas = document.querySelector('canvas');
    canvas.setAttribute('width', window.innerWidth);
    canvas.setAttribute('height', window.innerHeight);
    gl = canvas.getContext('webgl2');
    if (!gl) return

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader,vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        console.log(gl.getShaderInfoLog(vertexShader))

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader,fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        console.log(gl.getShaderInfoLog(fragmentShader))
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var err = gl.getProgramInfoLog(program)
        cleanup()
        console.log("link error: " + err)
        return
    }
    gl.useProgram(program);

    bufVertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufVertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0-1, -1, 0,
        0-1, 1, 0,
        1, 1, 0,
        0-1, -1, 0,
        1, 1, 0,
        1, -1, 0,
    ]), gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    bufIndices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,3,4,5]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    bufScale = gl.getUniformLocation(program, 'scale')
    bufCentreIn = gl.getUniformLocation(program, 'centreIn')
    bufCentreOut = gl.getUniformLocation(program, 'centreOut')

    gl.bindBuffer(gl.ARRAY_BUFFER, bufVertices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices);

    var pos = gl.getAttribLocation(program, 'pos');
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(pos);

    gl.activeTexture(gl.TEXTURE1)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    var palette = []
    const max_iter = 128
    update_palette(palette, max_iter)
    var imgdata = []
    for (var i=0; i<max_iter; i++)
        imgdata.push.apply(imgdata, palette[i])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                  max_iter, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array(imgdata));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    var bufPalette = gl.getUniformLocation(program, 'palette')
    gl.uniform1i(bufPalette, 1)

    window.addEventListener('resize', drawDOM)
    window.addEventListener('orientationchange', drawDOM)
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw()
}

var ts0 = null
function draw(ts) {
    if (!ts0) ts0 = ts
    gl.uniform1f(bufScale, Math.pow(1e6, Math.abs((Math.floor(ts)%40000)/20000-1)) * Math.min(canvas.width, canvas.height)/4)
    gl.uniform2fv(bufCentreIn, [-0.5946856221566517, -0.43560863385611454])
    gl.uniform2fv(bufCentreOut, [canvas.width/2, canvas.height/2])
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    window.requestAnimationFrame(draw)
}

function drawDOM() {
    canvas.setAttribute('width', window.innerWidth);
    canvas.setAttribute('height', window.innerHeight);
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function cleanup() {
    gl.useProgram(null);
    if (bufVertices)
        gl.deleteBuffer(bufVertices);
    if (bufIndices)
        gl.deleteBuffer(bufIndices);
    if (program)
        gl.deleteProgram(program);
}

function update_palette(palette, max_iteration) {
    for (var i=0; i<=max_iteration; i++) {
        var ii = i/max_iteration
        var c1 = [-1, 0, 0, 0], c
        [[0, 0, 7, 100],
         [0.19, 32, 107, 203],
         [0.5, 237, 255, 255],
         [0.77, 255, 170, 0],
         [1, 0, 2, 0],
        ].some((c2) => {
            if (ii > c2[0]) {
                c1 = c2
                return false
            }
            var d = (ii - c1[0]) / (c2[0] - c1[0])
            c = [
                c1[1] + d*(c2[1]-c1[1]),
                c1[2] + d*(c2[2]-c1[2]),
                c1[3] + d*(c2[3]-c1[3]),
                255,
            ]
            return true
        })
        palette[i] = c
    }
}
