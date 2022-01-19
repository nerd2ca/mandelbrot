new ui(
    new display({
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
    var disp = new display({
        renderers: [{ctor: nativeRenderer, canvas: canvas}],
        crosshair: true,
        minres: 1,
        width: 100,
        height: 100,
    })
    function show(jx, jy, tx, ty, scale, maxiter) {
        canvas.style.display = 'block'
        disp.crosshair = jx != 0 || jy != 0
        disp.setTarget(jx, jy, tx, ty, 2*scale, maxiter, 0)
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
            jy = parseFloat(params[5]) || 0
        setTarget(jx, jy, cx, cy, scale, maxiter, 0)
        setTarget(jx, jy, cx, cy, scale, maxiter, 0.5*Math.log(scale)/Math.log(2))
    }

    // show current coordinates in location bar
    var updhash
    function setTarget(jx, jy, cx, cy, scale, maxiter, seconds) {
        var roundscale = scale.toFixed(3)
        if (scale > 1000) roundscale = Math.ceil(scale)
        curhash = `#${cx}/${cy}/${roundscale}/${maxiter}/${jx}/${jy}`
        if (updhash)
            window.clearTimeout(updhash)
        updhash = window.setTimeout(() => {
            document.location.hash = curhash
        }, 250)
        display.setTarget(jx, jy, cx, cy, scale, maxiter, seconds)
        if (jx == 0 && jy == 0) pip.show(cx, cy, 0, 0, 0.2, maxiter)
        else pip.show(0, 0, jx, jy, scale, maxiter)
    }

    // drag = pan
    var dragging
    window.addEventListener('mouseup', e => {
        dragging = null
    })
    window.addEventListener('mousedown', e => {
        dragging = {lastX: e.clientX, lastY: e.clientY}
        var cur = display.currentView()
        display.setTarget(cur.jx, cur.jy, cur.cx, cur.cy, cur.scale, cur.maxiter)
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
            setTarget(jx - dx,
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
            setTarget(jx,
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
            setTarget(cur.jx,
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
        setTarget(cur.jx, cur.jy, cx, cy, cur.scale*mag, cur.maxiter)
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
                setTarget(0,
                          0,
                          cur.jx,
                          cur.jy,
                          cur.scale,
                          cur.maxiter)
            }
            pip.hide()
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
                setTarget(jx - (x - lasttouch.x)/cur.pixscale,
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
        setTarget(cur.jx,
                  cur.jy,
                  cur.cx - dx/cur.pixscale + magx/cur.pixscale*(1-1/mag),
                  cur.cy - dy/cur.pixscale + magy/cur.pixscale*(1-1/mag),
                  cur.scale*mag,
                  cur.maxiter)
    }
}
