var imgdata
var dragging = {x: 0, y: 0}
var touching = {dx: 0, dy: 0, scale: 1, startx: 0, starty: 0}
var plane = {width: window.innerWidth, height: window.innerHeight}
m.mount(document.body, {
    view: function(body) {
        return m('canvas', {
            width: plane.width,
            height: plane.height,
            oncreate: (canvas) => {
                canvas.attrs.draw(canvas)
            },
            onupdate: (canvas) => {
                canvas.attrs.draw(canvas)
            },
            draw: (canvas) => {
                const ctx = canvas.dom.getContext('2d')
                ctx.save()
                ctx.fillStyle = '#000'
                ctx.fillRect(0, 0, plane.width, plane.height)
                if (imgdata) {
                    ctx.drawImage(
                        imgdata,
                        (dragging.x+touching.dx) + ((touching.startx)*(1-touching.scale)),
                        (dragging.y+touching.dy) + ((touching.starty)*(1-touching.scale)),
                        plane.width * touching.scale,
                        plane.height * touching.scale)
                }
                ctx.restore()
            },
        })
    },
})
mandelbrot()
window.addEventListener('hashchange', mandelbrot)
window.addEventListener("resize", (e) => {
    plane = {width: window.innerWidth, height: window.innerHeight}
    mandelbrot.zero()
    mandelbrot.upd()
    m.redraw()
})
window.addEventListener("orientationchange", (e) => {
    plane = {width: window.innerWidth, height: window.innerHeight}
    mandelbrot.zero()
    mandelbrot.upd()
    m.redraw()
})
window.addEventListener("mouseup", (e) => {
    if (dragging.started) {
        mandelbrot.move(dragging.x, dragging.y)
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
    m.redraw()
})
window.addEventListener("wheel", (e) => {
    e.preventDefault()
    if (e.ctrlKey)
        mandelbrot.more_iterations(Math.pow(1.1, Math.max(Math.min(-e.deltaY/100, 1), -1)))
    else
        mandelbrot.zoom_n_move(e.clientX-e.target.clientWidth/2, e.clientY-e.target.clientHeight/2, Math.pow(1.5, Math.max(Math.min(-e.deltaY/100, 1), -1)), 0, 0)
    m.redraw()
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
        m.redraw()
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
    m.redraw()
}
function mandelbrot() {
    var max_iteration
    var cx, cy, scale
    var mpix, lores, x, y, alldone
    var mw, mh, sq
    var initres = 8
    var restart = false
    var palette = []
    mandelbrot.init = () => {
        var params = document.location.hash.substr(1).split('/')
        cx = parseFloat(params[0]) || 0
        cy = parseFloat(params[1]) || 0
        scale = parseFloat(params[2]) || 0
        max_iteration = parseInt(params[3]) || 128
        recentre()
        update_palette()
        mandelbrot.zero()
    }
    mandelbrot.more_iterations = (factor) => {
        max_iteration = Math.max(16, Math.ceil(max_iteration * factor))
        update_palette()
        recentre()
        restart = true
        mandelbrot.upd()
    }
    mandelbrot.zoom_n_move = (x, y, magnify, dx, dy) => {
        if (scale >= 1e13 && magnify > 1) return
        if (scale * magnify < 1/2.47)
            magnify = 1/2.47/scale
        cx += x/sq/scale*(1 - 1/magnify)
        cy += y/sq/scale*(1 - 1/magnify)
        scale = scale * magnify
        cx -= dx/sq/scale
        cy -= dy/sq/scale
        recentre()
        restart = true
        mandelbrot.upd()
    }
    function recentre() {
        if (scale < 1/2.47) scale = 1/2.47
        if (cx + 1/2/scale > 0.47) cx = Math.min(cx, 0.47 - 1/2/scale)
        if (cx - 1/2/scale < -2) cx = Math.max(cx, -2 + 1/2/scale)
        if (cy + 1/2/scale > 1.235) cy = Math.min(cy, 1.235 - 1/2/scale)
        if (cy - 1/2/scale < -1.235) cy = Math.max(cy, -1.235 + 1/2/scale)
        if (scale > 1e13) scale = 1e13
        var loc = document.location
        loc.hash = `${cx}/${cy}/${scale}/${max_iteration}`
        history.replaceState({}, 'mandelbrot', loc)
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
        mw = plane.width
        mh = plane.height
        sq = Math.min(mw, mh)
        mpix = new Uint8ClampedArray(mw*mh*4)
        lores = initres
        x = 0
        y = 0
        alldone = false
    }
    mandelbrot.plot = () => {
        if (lores == initres || (x % (lores*2) > 0) || (y % (lores*2) > 0)) {
            var x0 = ((x-(mw-sq)/2)/sq-0.5)/scale + cx
            var y0 = ((y-(mh-sq)/2)/sq-0.5)/scale + cy
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
            for (var py = 0; py < lores; py++) {
                var i = (((y+py)*mw)+x)*4
                for (var px = 0; px < lores; px++) {
                    mpix[i] = rgba[0]
                    mpix[i+1] = rgba[1]
                    mpix[i+2] = rgba[2]
                    mpix[i+3] = rgba[3]
                    i += 4
                }
            }
        }
        x += lores
        if (x >= mw) {
            x = 0
            y += lores
            if (y >= mh) {
                y = 0
                if (lores == 1)
                    alldone = true
                else
                    lores = Math.floor(lores/2)
            }
            if (y == 0) {
                createImageBitmap(new ImageData(mpix, mw), 0, 0, mw, mh, {
                    resizeWidth: plane.width,
                    resizeHeight: plane.height,
                }).then((bitmap) => {
                    imgdata = bitmap
                    m.redraw()
                })
            }
        }
    }
    var updTimer
    mandelbrot.upd = () => {
        if (restart) {
            mandelbrot.zero()
            restart = false
        } else if (alldone)
            return
        var pts = plane.width*plane.height/initres/initres
        for (var i=0; (i<pts || lores >= initres) && !alldone; i++)
            mandelbrot.plot()
        window.requestAnimationFrame(mandelbrot.upd)
    }
    mandelbrot.init()
    mandelbrot.upd()
}
