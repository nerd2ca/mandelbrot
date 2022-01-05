new ui(new display([
    {ctor: glRenderer, canvas: document.getElementById('gl')},
    {ctor: nativeRenderer, canvas: document.getElementById('nogl')},
]))

function ui(display) {
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
            maxiter = parseInt(params[3]) || 128
        setTarget(cx, cy, scale, maxiter, 0)
        setTarget(cx, cy, scale, maxiter, 2*Math.log(scale)/Math.log(2))
    }

    // show current coordinates in location bar
    var updhash
    function setTarget(cx, cy, scale, maxiter, seconds) {
        curhash = `#${cx}/${cy}/${scale}/${maxiter}`
        if (updhash)
            window.clearTimeout(updhash)
        updhash = window.setTimeout(() => {
            document.location.hash = curhash
        }, 250)
        display.setTarget(cx, cy, scale, maxiter, seconds)
    }

    // drag = pan
    var dragging
    window.addEventListener('mouseup', e => {
        dragging = null
    })
    window.addEventListener('mousedown', e => {
        dragging = {lastX: e.clientX, lastY: e.clientY}
        var cur = display.currentCamera()
        display.setTarget(cur.cx, cur.cy, cur.scale, cur.maxiter)
    })
    window.addEventListener('mousemove', e => {
        if (!e.buttons || !dragging) {
            dragging = null
            return
        }
        var cur = display.currentTarget()
        setTarget(cur.cx - (e.clientX - dragging.lastX)/cur.pixscale,
                  cur.cy - (e.clientY - dragging.lastY)/cur.pixscale,
                  cur.scale,
                  cur.maxiter)
        dragging.lastX = e.clientX
        dragging.lastY = e.clientY
    })

    // wheel = zoom in/out at point
    window.addEventListener('wheel', handleWheel, {passive: false})
    function handleWheel(e) {
        e.preventDefault()
        var cur = display.currentTarget()
        if (e.ctrlKey) {
            setTarget(cur.cx,
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
        setTarget(cx, cy, cur.scale*mag, cur.maxiter)
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
        if (e.targetTouches.length > 2)
            return
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
                span: span,
                x: x,
                y: y,
            }
        var dx = x - lasttouch.x,
            dy = y - lasttouch.y,
            mag = (lasttouch.span == 1 || span == 1 ? 1 : span/lasttouch.span)
        lasttouch = {x: x, y: y, span: span}

        var magx = x - e.target.clientWidth/2,
            magy = y - e.target.clientHeight/2
        var cur = display.currentTarget()
        setTarget(cur.cx - dx/cur.pixscale + magx/cur.pixscale*(1-1/mag),
                  cur.cy - dy/cur.pixscale + magy/cur.pixscale*(1-1/mag),
                  cur.scale*mag,
                  cur.maxiter)
    }
}
