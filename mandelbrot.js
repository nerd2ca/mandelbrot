var shiftDown = false
var onscreen = {ctx: null, frame: {}}
var dragging = {x: 0, y: 0}
var touching = {dx: 0, dy: 0, scale: 1, startx: 0, starty: 0}
var plane = {width: window.innerWidth, height: window.innerHeight}
var curhash
mandelbrot()
setupCanvas()
function drawFrame() {
    if (!onscreen.ctx || !onscreen.frame.img) return
    if (dragging.started)
        onscreen.ctx.fillRect(0, 0, plane.width, plane.height)
    onscreen.ctx.drawImage(
        onscreen.frame.img,
        (dragging.x+touching.dx) + ((touching.startx)*(1-touching.scale)),
        (dragging.y+touching.dy) + ((touching.starty)*(1-touching.scale)),
        plane.width * touching.scale,
        plane.height * touching.scale)
}
function setupCanvas() {
    var canvas = document.getElementsByTagName('canvas')[0]
    canvas.width = plane.width
    canvas.height = plane.height
    onscreen.ctx = canvas.getContext('2d')
    onscreen.ctx.fillStyle = '#000'
    drawFrame()
}
window.addEventListener('hashchange', () => {
    if (curhash != document.location.hash) {
        mandelbrot.init()
    }
})
window.addEventListener("resize", (e) => {
    plane = {width: window.innerWidth, height: window.innerHeight}
    mandelbrot.zero()
    setupCanvas()
})
window.addEventListener("orientationchange", (e) => {
    plane = {width: window.innerWidth, height: window.innerHeight}
    mandelbrot.zero()
    setupCanvas()
})
window.addEventListener("keydown", (e) => {
    if (e.key == 'Shift') shiftDown = true
})
window.addEventListener("keyup", (e) => {
    if (e.key == 'Shift') shiftDown = false
})
window.addEventListener("mouseup", (e) => {
    if (dragging.started) {
        mandelbrot.zoom_n_move(0, 0, 1, dragging.x, dragging.y)
        dragging.x = 0
        dragging.y = 0
        dragging.started = false
    }
})
window.addEventListener("mousemove", (e) => {
    if (e.buttons) {
        if (!dragging.started) {
            dragging.startX = e.clientX
            dragging.startY = e.clientY
            dragging.started = true
        } else {
            dragging.x = e.clientX - dragging.startX
            dragging.y = e.clientY - dragging.startY
        }
    } else if (dragging.started) {
        mandelbrot.zoom_n_move(0, 0, 1, dragging.x, dragging.y)
        dragging.x = 0
        dragging.y = 0
        dragging.started = false
    }
})
window.addEventListener("wheel", (e) => {
    e.preventDefault()
    if (e.ctrlKey)
        mandelbrot.more_iterations(Math.pow(1.1, Math.max(Math.min(-e.deltaY/100, 1), -1)))
    else
        mandelbrot.zoom_n_move(e.clientX-e.target.clientWidth/2, e.clientY-e.target.clientHeight/2, Math.pow(1.5, Math.max(Math.min(-e.deltaY/100, 1), -1)), 0, 0)
}, {passive: false})
;['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((et) => {
    window.addEventListener(et, handleTouch, {passive: false})
})
function handleTouch(e) {
    e.preventDefault()
    if (e.type == 'touchend' || e.type == 'touchcancel') {
        if (!touching.started)
            return
        mandelbrot.zoom_n_move(
            touching.startx-e.target.clientWidth/2,
            touching.starty-e.target.clientHeight/2,
            touching.scale,
            touching.dx, touching.dy)
        touching.scale = 1
        touching.dx = 0
        touching.dy = 0
        touching.started = false
        drawFrame()
        return
    }
    if (e.targetTouches.length > 2)
        return
    var span = 1
    var x = e.targetTouches[0].clientX
    var y = e.targetTouches[0].clientY
    if (e.targetTouches.length == 2) {
        span = Math.pow(
            Math.pow(x - e.targetTouches[1].clientX, 2) +
                Math.pow(y - e.targetTouches[1].clientY, 2), 1/2)
        x = (x + e.targetTouches[1].clientX) / 2
        y = (y + e.targetTouches[1].clientY) / 2
        if (touching.startspan == 1) {
            touching.startspan = span
            touching.startx += (e.targetTouches[1].clientX - e.targetTouches[0].clientX) / 2
            touching.starty += (e.targetTouches[1].clientY - e.targetTouches[0].clientY) / 2
        }
    }
    if (!touching.started) {
        touching.startx = x
        touching.starty = y
        touching.startspan = span
        touching.scale = 1
        touching.dx = 0
        touching.dy = 0
        touching.started = true
    } else {
        touching.scale = span / touching.startspan
        touching.dx = x - touching.startx
        touching.dy = y - touching.starty
        touching.ctrx = touching.startx + touching.dx
        touching.ctry = touching.starty + touching.dy
    }
    drawFrame()
}
function mandelbrot() {
    const initres = 8, flyfactor = 2, flyres = 2
    var max_iteration, cx, cy, scaletarget
    var x, y
    var updated = false
    var updhash
    var palette = []
    var frames = [], af_id, af_t
    mandelbrot.init = () => {
        curhash = document.location.hash
        var params = curhash.substr(1).split('/')
        cx = parseFloat(params[0]) || 0
        cy = parseFloat(params[1]) || 0
        scaletarget = parseFloat(params[2]) || 1/2.47
        max_iteration = parseInt(params[3]) || 128
        update_palette()
        x = 0
        y = 0
        frames = [newframe(1/2.47)]
        if (af_id)
            window.cancelAnimationFrame(af_id)
        af_id = window.requestAnimationFrame(animationFrame)
        af_t = null
    }
    function animationFrame(t) {
        if (frames.length < 1 || (scaletarget == frames[0].scale && !updated && !dragging.started && !touching.started))
            return window.requestAnimationFrame(animationFrame)
        updated = false
        if (frames.length > 1) {
            touching.dx = 0
            touching.dy = 0
            touching.startx = plane.width/2
            touching.starty = plane.height/2
            if (!af_t)
                af_t = performance.now()
            var progress = Math.min(1, (t - af_t) / frames[0].rendertime)
            if (progress == 1 && frames[1].img) {
                frames.shift()
                touching.scale = 1
                af_t = t
            } else
                touching.scale = Math.pow(frames[1].scale/frames[0].scale, progress)
        }
        if (frames[0].img)
            onscreen.frame = frames[0]
        drawFrame()
        window.requestAnimationFrame(animationFrame)
    }
    mandelbrot.more_iterations = (factor) => {
        max_iteration = Math.max(16, Math.ceil(max_iteration * factor))
        update_palette()
        recentre()
        mandelbrot.zero()
    }
    mandelbrot.zoom_n_move = (x, y, magnify, dx, dy) => {
        var scale = frames.length > 0 ? frames[0].scale : scaletarget
        var sq = Math.min(plane.width, plane.height)
        if (scale >= 1e13 && magnify > 1) return
        if (scale * magnify < 1/2.47)
            magnify = 1/2.47/scale
        cx += x/sq/scale*(1 - 1/magnify)
        cy += y/sq/scale*(1 - 1/magnify)
        scale = scale * magnify
        cx -= dx/sq/scale
        cy -= dy/sq/scale
        scaletarget = scale
        recentre()
        mandelbrot.zero()
    }
    function recentre() {
        if (scaletarget < 1/2.47) scaletarget = 1/2.47
        cx = Math.min(cx, 0.47)
        cx = Math.max(cx, -2)
        cy = Math.min(cy, 1.12)
        cy = Math.max(cy, -1.12)
        if (scaletarget > 1e13) scaletarget = 1e13
        curhash = `#${cx}/${cy}/${scaletarget}/${max_iteration}`
        if (updhash)
            window.clearTimeout(updhash)
        updhash = window.setTimeout(() => {
            document.location.hash = curhash
        }, 1000)
    }
    function update_palette() {
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
    mandelbrot.zero = () => {
        x = 0
        y = 0
        frames = [newframe(scaletarget)]
        mandelbrot.upd()
    }
    function newframe(scale) {
        var hires = scale < scaletarget ? flyfactor : 1
        var w = plane.width * hires
        var h = plane.height * hires
        return {
            renderstart: performance.now(),
            scale: scale,
            lores: initres,
            buf: new Uint8ClampedArray(w*h*4),
            w: w,
            h: h,
            sq: Math.min(w, h),
        }
    }
    mandelbrot.plot = () => {
        var f = frames[frames.length-1]
        if (f.lores == initres ||
            ((x % (f.lores*2) > 0) || (y % (f.lores*2) > 0)
             &&
             (f.lores > flyres || f.scale == scaletarget || Math.abs(x/f.w-0.5)<0.25 || Math.abs(y/f.h-0.5)<0.25))) {
            var x0 = ((x-(f.w-f.sq)/2)/f.sq-0.5)/f.scale + cx
            var y0 = ((y-(f.h-f.sq)/2)/f.sq-0.5)/f.scale + cy
            var ix = 0
            var iy = 0
            var iteration = 0
            while (iteration < max_iteration) {
                var ix2 = ix*ix, iy2 = iy*iy
                if (ix2 + iy2 > 4) break
                var xnext = ix2 - iy2 + x0
                iy = 2*ix*iy + y0
                ix = xnext
                iteration++
            }
            rgba = palette[iteration]
            for (var py = 0; py < f.lores && y+py < f.h; py++) {
                var i = (((y+py)*f.w)+x)*4
                for (var px = 0; px < f.lores && x+px < f.w; px++) {
                    f.buf[i] = rgba[0]
                    f.buf[i+1] = rgba[1]
                    f.buf[i+2] = rgba[2]
                    f.buf[i+3] = rgba[3]
                    i += 4
                }
            }
        }
        x += f.lores

        if (x < f.w) return
        x = 0
        y += f.lores
        if (y < f.h) return
        y = 0
        f.lores = Math.floor(f.lores/2)

        var curflyres = flyres * (shiftDown ? 2 : 1)

        if (f.scale < scaletarget && f.lores < curflyres)
            frames.push(newframe(Math.min(scaletarget, f.scale * flyfactor)))

        if (frames.length < 2 || f.lores < curflyres)
            createImageBitmap(new ImageData(f.buf, f.w), 0, 0, f.w, f.h, {
                resizeWidth: f.w,
                resizeHeight: f.h,
            }).then((img) => {
                updated = true
                f.rendertime = performance.now() - f.renderstart
                f.img = img
            })
    }
    mandelbrot.upd = () => {
        var pts = Math.ceil(plane.width*plane.height/initres)/initres
        for (var i=0; (i<pts || frames[0].lores == initres) && frames[frames.length-1].lores > 0; i++)
            mandelbrot.plot()
    }
    function updateLoop() {
        mandelbrot.upd()
        window.requestAnimationFrame(updateLoop)
    }
    mandelbrot.init()
    updateLoop()
}
