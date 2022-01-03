"use strict"

const glMaxIteration = 192

var fragmentShader64Source = `
#version 100
precision highp float;
uniform int max_iter;
uniform float scale;
uniform vec4 centreIn;
uniform vec2 centreOut;
uniform sampler2D palette;
uniform vec4 zero; // hope to prevent compiler from optimizing out double-float ops
void shade32() {
    float x0 = centreIn.x + (gl_FragCoord.x - centreOut.x) / scale;
    float y0 = centreIn.z - (gl_FragCoord.y - centreOut.y) / scale;
    float ix = 0.0;
    float iy = 0.0;
    int c = -1;
    const int glMaxIteration = `+glMaxIteration+`;
    for (int iter = 0; iter < glMaxIteration; iter++) {
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
// http://andrewthall.org/papers/df64_qf128.pdf
vec2 quickTwoSum(float a , float b) {
    float s = a + b;
    float e = b - (s+zero.x-a);
    return vec2(s, e);
}
vec4 twoSumComp(vec2 a, vec2 b) {
    vec2 s = a + b;
    vec2 v = s + zero.xy - a;
    vec2 e = (a - (s-zero.x-v)) + (b+zero.x-v);
    return vec4(s.x, e.x, s.y, e.y);
}
vec2 df64add(vec2 a, vec2 b) {
    vec4 st = twoSumComp(a, b);
    st.y += st.z;
    st.xy = quickTwoSum(st.x, st.y);
    st.y += st.w;
    return quickTwoSum(st.x, st.y);
}
vec4 splitComp(vec2 c) {
    const float split = 4097.0;
    vec2 t = c * split;
    vec2 c_hi = t - (t+zero.xy-c);
    vec2 c_lo = c - c_hi;
    return vec4(c_hi.x, c_lo.x, c_hi.y, c_lo.y);
}
vec2 twoProd(float a, float b) {
    float p = a*b;
    vec4 abS = splitComp(vec2(a, b));
    float err = ((abS.x*abS.z - p)
                 + abS.x*abS.w
                 + abS.y*abS.z
                 + abS.y*abS.w);
    return vec2(p, err);
}
vec2 df64mult(vec2 a, vec2 b) {
    vec2 p = twoProd(a.x, b.x);
    p.y += a.x * b.y;
    p.y += a.y * b.x;
    return quickTwoSum(p.x, p.y);
}
vec2 df64sq(vec2 a) {
    vec2 p = twoProd(a.x, a.x);
    p.y += a.x * a.y * 2.0;
    return quickTwoSum(p.x, p.y);
}
void main() {
    if (gl_FragCoord.y < 4.0) {
        if (gl_FragCoord.x > centreOut.x*2.0 * log(scale) / log(10.0) / 16.0)
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        else
            gl_FragColor = vec4(0.5, 0.5, 1.0, 1.0);
        return;
    }
    if (scale < 1e5) {
        shade32();
        return;
    }
    float xscale = 1.0/scale;
    vec2 x0 = df64add(centreIn.xy, df64mult(vec2(gl_FragCoord.x - centreOut.x, 0.0), vec2(xscale, 0.0)));
    vec2 y0 = df64add(centreIn.zw, df64mult(vec2(centreOut.y - gl_FragCoord.y, 0.0), vec2(xscale, 0.0)));
    int c = -1;
    vec4 ixy;
    const int glMaxIteration = `+glMaxIteration+`;
    for (int iter = 0; iter < glMaxIteration; iter++) {
        if (c >= 0 || iter >= max_iter)
            continue;
        vec4 sq = vec4(df64sq(ixy.xy), df64sq(ixy.zw));
        vec2 dsq = df64add(sq.xy, sq.zw);
        if (dsq.x > 4.0) {
            c = iter;
            continue;
        }
        ixy = vec4(
            df64add(x0, df64add(sq.xy, -1.0 * sq.zw)),
            df64add(y0, 2.0 * df64mult(ixy.xy, ixy.zw)));
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

var GlRender = false
;(function() {
    var gl,
        program,
        bufIndices,
        bufVertices,
        bufMaxIter,
        bufScale,
        bufPalette,
        bufCentreIn,
        bufCentreOut,
        usingPalette,
        canvas,
        drawn = {}
    canvas = document.getElementById('gl')
    canvas.setAttribute('width', window.innerWidth)
    canvas.setAttribute('height', window.innerHeight)
    gl = canvas.getContext('webgl2')
    if (!gl) return

    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vertexShader,vertexShaderSource)
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        console.log(gl.getShaderInfoLog(vertexShader))

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fragmentShader,fragmentShader64Source)
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        console.log(gl.getShaderInfoLog(fragmentShader))

    program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.detachShader(program, vertexShader)
    gl.detachShader(program, fragmentShader)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var err = gl.getProgramInfoLog(program)
        cleanup()
        console.log("link error: " + err)
        return
    }
    gl.useProgram(program)

    bufVertices = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, bufVertices)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0-1, -1, 0,
        0-1, 1, 0,
        1, 1, 0,
        0-1, -1, 0,
        1, 1, 0,
        1, -1, 0,
    ]), gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    bufIndices = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,3,4,5]), gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

    bufMaxIter = gl.getUniformLocation(program, 'max_iter')
    bufScale = gl.getUniformLocation(program, 'scale')
    bufCentreIn = gl.getUniformLocation(program, 'centreIn')
    bufCentreOut = gl.getUniformLocation(program, 'centreOut')
    bufPalette = gl.getUniformLocation(program, 'palette')

    gl.bindBuffer(gl.ARRAY_BUFFER, bufVertices)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices)

    var pos = gl.getAttribLocation(program, 'pos')
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(pos)

    gl.activeTexture(gl.TEXTURE1)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)

    GlRender = draw

    window.addEventListener("resize", resize)
    window.addEventListener("orientationchange", resize)
    function resize() {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    }

    function df64(a, b) {
        const splitter = (1<<29)+1
        var at = a*splitter
        var ahi = at-(at-a)
        var bt = b*splitter
        var bhi = bt-(bt-b)
        return [ahi, a-ahi, bhi, b-bhi]
    }

    function draw(cx, cy, scale, palette) {
        if (drawn.cx == cx &&
            drawn.cy == cy &&
            drawn.scale == scale &&
            drawn.width == canvas.width &&
            drawn.height == canvas.height &&
            drawn.palette == palette.length)
            return
        drawn.cx = cx
        drawn.cy = cy
        drawn.scale = scale
        drawn.width = canvas.width
        drawn.height = canvas.height
        if (drawn.palette !== palette.length) {
            drawn.palette = palette.length
            var psize
            for (psize = 1; psize < palette.length; psize = psize << 1) {}
            var imgdata = []
            for (var i=0; i<psize; i++)
                imgdata.push.apply(imgdata, palette[i >= palette.length ? palette.length-1 : i])
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                          psize, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                          new Uint8Array(imgdata))
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.uniform1i(bufPalette, 1)
        }
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform1i(bufMaxIter, palette.length)
        gl.uniform1f(bufScale, scale * Math.min(canvas.width, canvas.height))
        gl.uniform4fv(bufCentreIn, df64(cx, cy))
        gl.uniform2fv(bufCentreOut, [canvas.width/2, canvas.height/2])
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    }

    function cleanup() {
        gl.useProgram(null)
        if (bufVertices)
            gl.deleteBuffer(bufVertices)
        if (bufIndices)
            gl.deleteBuffer(bufIndices)
        if (program)
            gl.deleteProgram(program)
    }
})()
