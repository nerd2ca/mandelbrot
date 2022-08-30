new ui(
    new Display({
        renderers: [
            {ctor: glRenderer, canvas: document.getElementById('gl')},
            {ctor: nativeRenderer, canvas: document.getElementById('nogl')},
        ],
    }),
    new Pip(document.getElementById('pip')),
)

function Pip(canvas) {
    canvas.style.position = 'absolute'
    canvas.style.left = 0
    canvas.style.top = 0
    this.show = show
    this.hide = hide
    hide()
    var disp = new Display({
        renderers: [{ctor: nativeRenderer, canvas: canvas}],
        crosshair: true,
        minres: 1,
        width: 100,
        height: 100,
    })
    function show(ftype, jx, jy, tx, ty, scale, maxiter, seconds) {
        canvas.style.display = 'block'
        disp.crosshair = jx != 0 || jy != 0
        disp.setTarget(ftype, jx, jy, tx, ty, 2*scale, maxiter, seconds)
    }
    function hide() {
        canvas.style.display = 'none'
    }
}

function ui(display, pip) {
    // move to coordinates specified by location bar
    var curhash
    window.addEventListener('hashchange', useHash)
    useHash()
    function useHash() {
        if (curhash == document.location.hash)
            return
        curhash = document.location.hash
        var params = curhash.substr(1).split('/')
        var cx = parseFloat(params[0]) || 0,
            cy = parseFloat(params[1]) || 0,
            scale = parseFloat(params[2]) || 1,
            maxiter = parseInt(params[3]) || 128,
            jx = parseFloat(params[4]) || 0,
            jy = parseFloat(params[5]) || 0,
            ftype = parseInt(params[6]) || 1
        setTarget(ftype, jx, jy, cx, cy, scale, maxiter, 0)
        setTarget(ftype, jx, jy, cx, cy, scale, maxiter, 0.5*Math.log(scale)/Math.log(2))
    }

    // show current coordinates in location bar
    var updhash
    function setTarget(ftype, jx, jy, cx, cy, scale, maxiter, seconds) {
        var roundscale = scale.toFixed(3)
        if (scale > 1000) roundscale = Math.ceil(scale)
        curhash = `#${cx}/${cy}/${roundscale}/${maxiter}/${jx}/${jy}/${ftype}`
        if (updhash)
            window.clearTimeout(updhash)
        updhash = window.setTimeout(() => {
            document.location.hash = curhash
        }, 250)
        display.setTarget(ftype, jx, jy, cx, cy, scale, maxiter, seconds)
        if (jx == 0 && jy == 0) pip.show(1, cx, cy, 0, 0, 0.2, maxiter, seconds)
        else pip.show(2, 0, 0, jx, jy, scale, maxiter, seconds)
    }

    window.addEventListener('keydown', async e => {
        if (e.key == 's' && e.ctrlKey) {
            e.preventDefault()
            const cur = display.currentView()
            const fh = await window.showSaveFilePicker({
                suggestedName: (
                    cur.jx==0 && cur.jy==0
                        ? `mandelbrot @ ${ri(cur.cx, cur.cy)} mag ${cur.scale} max ${cur.maxiter}.png`
                    : `julia c=${ri(cur.jx, cur.jy)} @ ${ri(cur.cx, cur.cy)} mag ${cur.scale} max ${cur.maxiter}.png`),
            })
            const ws = await fh.createWritable()
            const canvas = document.createElement('canvas')
            document.body.style.overflow = 'hidden'
            const overlay = document.createElement('div')
            overlay.style.width = '100%'
            overlay.style.height = '100%'
            overlay.style.position = 'absolute'
            overlay.style.left = 0
            overlay.style.top = 0
            overlay.style.background = '#000'
            overlay.style.opacity = 0.5
            document.body.appendChild(canvas)
            document.body.insertBefore(overlay, document.body.children.item(0))
            const cleanup = () => {
                document.body.removeChild(canvas)
                document.body.removeChild(overlay)
            }
            var ready = false
            const disp = new Display({
                renderers: [{ctor: nativeRenderer, canvas: canvas}],
                minres: 1,
                width: 10000,
                height: 10000,
                onidle: () => {
                    if (!ready) return
                    ready = false
                    canvas.toBlob(blob => {
                        (async function() {
                            await ws.write(blob)
                            await ws.close()
                            cleanup()
                        })().catch(err => {
                            console.log(err)
                            cleanup()
                        })
                    })
                },
            })
            disp.setTarget(cur.ftype, cur.jx, cur.jy, cur.cx, cur.cy, cur.scale, cur.maxiter, 0)
            ready = true
        }
    })

    // drag = pan
    var dragging
    window.addEventListener('mouseup', e => {
        dragging = null
    })
    window.addEventListener('mousedown', e => {
        dragging = {lastX: e.clientX, lastY: e.clientY}
        var cur = display.currentView()
        display.setTarget(cur.ftype, cur.jx, cur.jy, cur.cx, cur.cy, cur.scale, cur.maxiter)
    })
    window.addEventListener('mousemove', e => {
        if (!e.buttons || !dragging) {
            dragging = null
            return
        }
        var cur = display.currentView()
        var dx = (e.clientX - dragging.lastX)/cur.pixscale,
            dy = (e.clientY - dragging.lastY)/cur.pixscale,
            cx = cur.cx,
            cy = cur.cy,
            jx = cur.jx,
            jy = cur.jy
        if (e.shiftKey) {
            if (jx == 0 && jy == 0) {
                jx = cur.cx
                jy = cur.cy
            }
            setTarget(cur.ftype,
                      jx - dx,
                      jy - dy,
                      cx,
                      cy,
                      cur.scale,
                      cur.maxiter)
        } else {
            if (e.ctrlKey && (jx != 0 || jy != 0)) {
                cx = jx
                cy = jy
                jx = 0
                jy = 0
            }
            setTarget(cur.ftype,
                      jx,
                      jy,
                      cx - dx,
                      cy - dy,
                      cur.scale,
                      cur.maxiter)
        }
        dragging.lastX = e.clientX
        dragging.lastY = e.clientY
    })

    // wheel = zoom in/out at point
    window.addEventListener('wheel', handleWheel, {passive: false})
    function handleWheel(e) {
        e.preventDefault()
        var cur = display.currentView()
        if (e.ctrlKey) {
            setTarget(cur.ftype,
                      cur.jx,
                      cur.jy,
                      cur.cx,
                      cur.cy,
                      cur.scale,
                      Math.ceil(cur.maxiter*Math.pow(1.1, Math.max(Math.min(-e.deltaY/100, 1), -1))))
            return
        }
        var dx = e.clientX - e.target.clientWidth/2
        var dy = e.clientY - e.target.clientHeight/2
        var mag = Math.pow(1.5, Math.max(Math.min(-e.deltaY/100, 1), -1))
        var cx = cur.cx + dx/cur.pixscale*(1-1/mag)
        var cy = cur.cy + dy/cur.pixscale*(1-1/mag)
        setTarget(cur.ftype, cur.jx, cur.jy, cx, cy, cur.scale*mag, cur.maxiter)
    }
    ;['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((et) => {
        window.addEventListener(et, handleTouch, {passive: false})
    })

    // 1-touch = pan; 2-touch = pan + zoom in/out
    var lasttouch
    function handleTouch(e) {
        e.preventDefault()
        if (e.type == 'touchend' || e.type == 'touchcancel') {
            lasttouch = null
            return
        }
        var cur = display.currentView()
        if (e.targetTouches.length > 3) {
            if (cur.jx != 0 || cur.jy != 0) {
                setTarget(cur.ftype,
                          0,
                          0,
                          cur.jx,
                          cur.jy,
                          cur.scale,
                          cur.maxiter)
            }
            lasttouch = null
            return
        }
        if (e.targetTouches.length > 2) {
            var x = (e.targetTouches[0].clientX + e.targetTouches[1].clientX + e.targetTouches[2].clientX)/3,
                y = (e.targetTouches[0].clientY + e.targetTouches[1].clientY + e.targetTouches[2].clientY)/3
            if (lasttouch && lasttouch.n == e.targetTouches.length) {
                var jx = cur.jx,
                    jy = cur.jy
                if (jx == 0 && jy == 0) {
                    jx = cur.cx
                    jy = cur.cy
                }
                setTarget(cur.ftype,
                          jx - (x - lasttouch.x)/cur.pixscale,
                          jy - (y - lasttouch.y)/cur.pixscale,
                          cur.cx,
                          cur.cy,
                          cur.scale,
                          cur.maxiter)
            }
            lasttouch = {
                n: e.targetTouches.length,
                span: 1,
                x: x,
                y: y,
            }
            return
        }
        var span = 1,
            x = e.targetTouches[0].clientX,
            y = e.targetTouches[0].clientY
        if (e.targetTouches.length == 2) {
            span = Math.pow(
                Math.pow(x - e.targetTouches[1].clientX, 2) +
                    Math.pow(y - e.targetTouches[1].clientY, 2), 1/2)
            x = (e.targetTouches[1].clientX + e.targetTouches[0].clientX) / 2
            y = (e.targetTouches[1].clientY + e.targetTouches[0].clientY) / 2
        }
        if (!lasttouch || (lasttouch.span == 1 && e.targetTouches.length == 2))
            lasttouch = {
                n: e.targetTouches.length,
                span: span,
                x: x,
                y: y,
            }
        var dx = x - lasttouch.x,
            dy = y - lasttouch.y,
            mag = (lasttouch.span == 1 || span == 1 ? 1 : span/lasttouch.span)
        lasttouch = {
            n: e.targetTouches.length,
            x: x,
            y: y,
            span: span,
        }
        var magx = x - e.target.clientWidth/2,
            magy = y - e.target.clientHeight/2
        setTarget(cur.ftype,
                  cur.jx,
                  cur.jy,
                  cur.cx - dx/cur.pixscale + magx/cur.pixscale*(1-1/mag),
                  cur.cy - dy/cur.pixscale + magy/cur.pixscale*(1-1/mag),
                  cur.scale*mag,
                  cur.maxiter)
    }
}

function ri(x, y) {
    if (y < 0)
        return `${x}${y}i`
    else
        return `${x}+${y}i`
}
