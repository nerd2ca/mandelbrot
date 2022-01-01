"use strict"

var fragmentShaderSource = `
#version 100
precision highp float;
uniform float scale;
void main() {
    float sq = 1200.0;
    float x0 = (gl_FragCoord.x - sq/2.0) / scale / sq;
    float y0 = (gl_FragCoord.y - sq/2.0) / scale / sq;
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
    float cc = 1.0 - float(c) / float(max_iter);
    gl_FragColor = vec4(cc*32.0/255.0, cc*107.0/255.0, cc*203.0/255.0, 1.0);
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

    gl.bindBuffer(gl.ARRAY_BUFFER, bufVertices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices);

    var pos = gl.getAttribLocation(program, 'pos');
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(pos);
    gl.viewport(0, 0, canvas.width, canvas.height);

    draw()
    window.addEventListener('resize', drawDOM)
    window.addEventListener('orientationchange', drawDOM)
}

var ts0 = null
function draw(ts) {
    if (!ts0) ts0 = ts
    gl.uniform1f(bufScale, 0.5*(1+((ts-ts0)%5000)/3000))
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
