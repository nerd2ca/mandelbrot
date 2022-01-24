const glMaxIteration = 192
const wantfb = false

var fragmentShader64Source = `
#version 100
precision highp float;
uniform int max_iter;
uniform vec4 julia;
uniform vec4 centreIn;
uniform vec2 centreOut;
uniform float scale;
uniform sampler2D palette;
uniform int psize;
uniform vec4 zero; // hope to prevent compiler from optimizing out double-float ops
void pick(int c) {
    if (c < 0 || c >= max_iter)
        c = max_iter-1;
    gl_FragColor = texture2D(palette, vec2(float(c)/float(psize), 0.5));
}
void shade32() {
    vec2 xy0 = vec2(centreIn.x + (gl_FragCoord.x - centreOut.x) * scale,
                    centreIn.z - (gl_FragCoord.y - centreOut.y) * scale);
    vec2 ixy = vec2(0.0, 0.0);
    if (julia.xz != ixy) {
        ixy = xy0;
        xy0 = julia.xz;
    }
    int c = -1;
    const int iterlimit = glMaxIteration;
    for (int iter = 0; iter < iterlimit; iter++) {
        if (c >= 0 || iter >= max_iter)
            continue;
        vec2 ixy2 = ixy*ixy;
        if (ixy2.x + ixy2.y >= 4.0) {
            c = iter;
            continue;
        }
        ixy = vec2(ixy2.x - ixy2.y + xy0.x,
                   2.0 * ixy.x * ixy.y + xy0.y);
    }
    pick(c);
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
    float axy = a.x * a.y;
    p.y += axy+axy;
    return quickTwoSum(p.x, p.y);
}
void main() {
    if (scale > 1e-6) {
        shade32();
        return;
    }
    vec2 x0 = df64add(centreIn.xy, df64mult(vec2(gl_FragCoord.x - centreOut.x, 0.0), vec2(scale, 0.0)));
    vec2 y0 = df64add(centreIn.zw, df64mult(vec2(centreOut.y - gl_FragCoord.y, 0.0), vec2(scale, 0.0)));
    int c = -1;
    vec4 ixy;
    if (julia != ixy) {
        ixy = vec4(x0, y0);
        x0 = julia.xy;
        y0 = julia.zw;
    }
    const int iterlimit = glMaxIteration;
    for (int iter = 0; iter < iterlimit; iter++) {
        if (c >= 0 || iter >= max_iter)
            continue;
        vec4 sq = vec4(df64sq(ixy.xy), df64sq(ixy.zw));
        vec2 dsq = df64add(sq.xy, sq.zw);
        if (dsq.x >= 4.0 && (dsq.x > 4.0 || dsq.y >= 0.0)) {
            c = iter;
            continue;
        }
        ixy = vec4(
            df64add(x0, df64add(sq.xy, -1.0 * sq.zw)),
            df64add(y0, 2.0 * df64mult(ixy.xy, ixy.zw)));
    }
    pick(c);
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

function glRenderer(args) {
    var gl,
        program,
        programMaxIteration,
        bufIndices,
        bufVertices,
        bufPaletteSize,
        bufMaxIter,
        bufScale,
        bufPalette,
        bufJulia,
        bufCentreIn,
        bufCentreOut,
        usingPalette,
        width,
        height,
        drawn = {},
        drawing = {},
        fenceSync
    this.setSize = setSize
    this.render = render
    this.renderShown = renderFinished
    this.renderFinished = renderFinished
    this.rerender = rerender

    args.canvas.addEventListener("webglcontextlost", ev => {
        ev.preventDefault()
        drawing.palette = false
        this.ready = false
        cleanup()
        args.redraw()
    })
    args.canvas.addEventListener("webglcontextrestored", ev => {
        this.ready = setupProgram(128)
    })

    if (document.location.toString().indexOf('nogl') >= 0) {
        return
    }
    if (document.location.toString().indexOf('chaosmonkey') >= 0) {
        var chaosmonkey = 1, ctxext
        window.setInterval(_ => {
            if (!ctxext)
                ctxext = gl.getExtension('WEBGL_lose_context')
            if (chaosmonkey % 2 == 1)
                ctxext.loseContext()
            else
                ctxext.restoreContext();
            chaosmonkey++
        }, 2000)
    }
    this.ready = setupProgram(128)

    function df64(a, b) {
        const splitter = (1<<29)+1
        var at = a*splitter
        var ahi = at-(at-a)
        var bt = b*splitter
        var bhi = bt-(bt-b)
        return [ahi, a-ahi, bhi, b-bhi]
    }

    function setSize(w, h) {
        width = w
        height = h
    }

    function rerender(scale) {
        if (drawn.width !== width || drawn.height !== height) return
        if (wantfb) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, drawn.fb)
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
            var mag = scale / drawn.scale
            var sw = drawn.width / mag
            var sh = drawn.height / mag
            gl.blitFramebuffer((drawn.width-sw)/2, (drawn.height-sh)/2, sw, sh,
                               0, 0, drawn.width, drawn.height,
                               gl.COLOR_BUFFER_BIT, gl.LINEAR)
        }
    }

    function renderFinished() {
        if (fenceSync && gl && gl.isSync(fenceSync) && gl.clientWaitSync(fenceSync, 0, 0) == gl.TIMEOUT_EXPIRED)
            return false
        fenceSync = null
        return true
    }

    function render(jx, jy, cx, cy, scale, palette) {
        if (gl.isContextLost()) {
            drawing.palette = false
            this.ready = false
            return false
        }
        if (fenceSync) {
            if (gl.clientWaitSync(fenceSync, 0, 0) == gl.TIMEOUT_EXPIRED)
                return
            fenceSync = null
            drawn.jx = drawing.jx
            drawn.jy = drawing.jy
            drawn.cx = drawing.cx
            drawn.cy = drawing.cy
            drawn.scale = drawing.scale
            drawn.width = drawing.width
            drawn.height = drawing.height
            drawn.palette = drawing.palette

            if (wantfb) {
                const fb = drawn.fb
                drawn.fb = drawing.fb
                drawing.fb = fb
            }
        }
        if (drawn.jx == jx &&
            drawn.jy == jy &&
            drawn.cx == cx &&
            drawn.cy == cy &&
            drawn.scale == scale &&
            drawn.width == width &&
            drawn.height == height &&
            drawn.palette == palette.length)
            return
        drawing.jx = jx
        drawing.jy = jy
        drawing.cx = cx
        drawing.cy = cy
        drawing.scale = scale
        drawing.width = width
        drawing.height = height
        var psize
        for (psize=1; psize<palette.length; psize=psize*2) {}
        if (drawing.palette !== palette.length) {
            if (palette.length*1.2 < programMaxIteration || palette.length > programMaxIteration)
                setupProgram(Math.ceil(palette.length*1.1))
            drawing.palette = palette.length
            var imgdata = []
            for (var i=0; i<palette.length; i++)
                imgdata.push.apply(imgdata, palette[i])
            for (var i=palette.length; i<psize; i++)
                imgdata.push.apply(imgdata, palette[palette.length-1])
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                          psize, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                          new Uint8Array(imgdata))
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.uniform1i(bufPalette, 1)
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, width, height)
        gl.uniform1i(bufMaxIter, palette.length)
        gl.uniform1i(bufPaletteSize, psize)
        gl.uniform4fv(bufJulia, df64(jx, jy))
        gl.uniform4fv(bufCentreIn, df64(cx, cy))
        gl.uniform2fv(bufCentreOut, [width/2, height/2])
        gl.uniform1f(bufScale, 1/(scale * Math.min(width, height)))
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

        if (wantfb) {
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, drawing.tex)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                          drawing.width, drawing.height, 0,
                          gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, drawing.fb)
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, drawing.tex, 0)
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawing.fb)
            gl.blitFramebuffer(0, 0, drawing.width, drawing.height,
                               0, 0, drawing.width, drawing.height,
                               gl.COLOR_BUFFER_BIT, gl.LINEAR)
        }
        fenceSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    }

    function setupProgram(maxiter) {
        if (!gl) gl = args.canvas.getContext('webgl2', {antialias: false})
        if (!gl) return

        if (wantfb) {
            drawn.fb = gl.createFramebuffer()
            drawn.tex = gl.createTexture()
            drawing.fb = gl.createFramebuffer()
            drawing.tex = gl.createTexture()
        }

        var vertexShader = gl.createShader(gl.VERTEX_SHADER)
        gl.shaderSource(vertexShader, vertexShaderSource)
        gl.compileShader(vertexShader)
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
            console.log(gl.getShaderInfoLog(vertexShader))

        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
        gl.shaderSource(fragmentShader,fragmentShader64Source.replaceAll('glMaxIteration', maxiter))
        gl.compileShader(fragmentShader)
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
            console.log(gl.getShaderInfoLog(fragmentShader))

        programMaxIteration = maxiter
        if (program) gl.deleteProgram(program)
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

        bufPaletteSize = gl.getUniformLocation(program, 'psize')
        bufMaxIter = gl.getUniformLocation(program, 'max_iter')
        bufScale = gl.getUniformLocation(program, 'scale')
        bufJulia = gl.getUniformLocation(program, 'julia')
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

        return true
    }

    function cleanup() {
        if (!gl)
            return
        gl.useProgram(null)
        if (bufVertices)
            gl.deleteBuffer(bufVertices)
        if (bufIndices)
            gl.deleteBuffer(bufIndices)
        if (program)
            gl.deleteProgram(program)
        drawing.palette = null
        this.ready = false
    }
}
