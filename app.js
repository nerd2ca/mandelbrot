var imgdata
var dragging = {x: 0, y: 0}
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
                let region = new Path2D()
                var sq = Math.floor(Math.min(plane.width, plane.height))
                region.rect((plane.width-sq)/2, (plane.height-sq)/2, sq, sq)
                ctx.clip(region)
                if (imgdata) {
                    ctx.drawImage(imgdata, (plane.width-sq)/2 + dragging.x, (plane.height-sq)/2 + dragging.y)
                }
                ctx.restore()
            },
        })
    },
})
window.addEventListener("resize", (e) => {
    plane = {width: window.innerWidth, height: window.innerHeight}
    mandelbrot.zero()
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
        mandelbrot.move(dragging.x, dragging.y)
        dragging.x = 0
        dragging.y = 0
        dragging.started = false
    }
    m.redraw()
})
window.addEventListener("wheel", (e) => {
    mandelbrot.zoom(e.clientX-e.target.clientWidth/2, e.clientY-e.target.clientHeight/2, Math.pow(1.5, Math.max(Math.min(-e.deltaY/100, 1), -1)))
    m.redraw()
})
mandelbrot()
function mandelbrot() {
    var cx, cy, scale
    var mpix, lores, x, y, alldone
    var mw, mh
    var initres = 8
    var restart = false
    mandelbrot.init = () => {
        var params = document.location.hash.substr(1).split('/')
        cx = parseFloat(params[0]) || 0
        cy = parseFloat(params[1]) || 0
        scale = parseFloat(params[2]) || 0
        recentre()
        mandelbrot.zero()
    }
    mandelbrot.move = (x, y) => {
        cx -= x/mw/scale
        cy -= y/mh/scale
        recentre()
        restart = true
    }
    mandelbrot.zoom = (x, y, magnify) => {
        if (scale * magnify < 1/2.47)
            magnify = 1/2.47/scale
        cx += x/mw/scale*(1 - 1/magnify)
        cy += y/mw/scale*(1 - 1/magnify)
        scale = scale * magnify
        recentre()
        restart = true
    }
    function recentre() {
        if (scale < 1/2.47) scale = 1/2.47
        if (cx + 1/2/scale > 0.47) cx = Math.min(cx, 0.47 - 1/2/scale)
        if (cx - 1/2/scale < -2) cx = Math.max(cx, -2 + 1/2/scale)
        if (cy + 1/2/scale > 1.235) cy = Math.min(cy, 1.235 - 1/2/scale)
        if (cy - 1/2/scale < -1.235) cy = Math.max(cy, -1.235 + 1/2/scale)
        var loc = document.location
        loc.hash = `${cx}/${cy}/${scale}`
        history.replaceState({}, 'mandelbrot', loc)
    }
    mandelbrot.zero = () => {
        mw = Math.min(plane.width, plane.height)
        mh = Math.min(plane.width, plane.height)
        mpix = new Uint8ClampedArray(mw*mh*4)
        lores = initres
        x = 0
        y = 0
        alldone = false
    }
    mandelbrot.plot = () => {
        if (lores == initres || x % (lores*2) > 0 || y % (lores*2) > 0) {
            var x0 = (x/mw-0.5)/scale + cx
            var y0 = (y/mh-0.5)/scale + cy
            var ix = 0
            var iy = 0
            var iteration = 0
            const max_iteration = 128
            while (ix*ix + iy*iy <= 2*2 && iteration < max_iteration) {
                var xtemp = ix*ix - iy*iy + x0
                iy = 2*ix*iy + y0
                ix = xtemp
                iteration++
            }

            var z = Math.floor(1024 * (1 - iteration / max_iteration))
            var b = Math.min(z, 255)
            var r = Math.min(Math.max(z-256, 0), 255)/2 + b/2
            var g = Math.max(z-512, 0)/6 + b/6
            for (var py = 0; py < lores; py++) {
                var i = (((y+py)*mw)+x)*4
                for (var px = 0; px < lores; px++) {
                    mpix[i] = r
                    mpix[i+1] = g
                    mpix[i+2] = b
                    mpix[i+3] = 255
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
            createImageBitmap(new ImageData(mpix, mw), 0, 0, mw, mh, {
                resizeWidth: Math.min(plane.width, plane.height),
                resizeHeight: Math.min(plane.width, plane.height),
            }).then((bitmap) => {
                imgdata = bitmap
            })
            m.redraw()
        }
    }
    mandelbrot.upd = () => {
        if (restart) {
            restart = false
            mandelbrot.zero()
        }
        for (var i=0; (i<1000 || lores >= initres) && !alldone; i++)
            mandelbrot.plot()
        window.setTimeout(mandelbrot.upd, alldone ? 1000 : 10)
    }
    mandelbrot.init()
    mandelbrot.upd()
}
