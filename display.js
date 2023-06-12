function Display(args) {
    var af_id,
        w,
        h,
        palette = [],
        target = {
            jx: 0,
            jy: 0,
            cx: 0,
            cy: 0,
            scale: 1,
            maxiter: 2,
            travel: 'zoom@2',
            travelfunc: travelfunc(0,0,0,0,0,1,2,'zoom@2'),
            t1: -1,
        },
        view = {
            jx: 0,
            jy: 0,
            cx: 0,
            cy: 0,
            scale: 1,
            maxiter: 2,
            travel: 'zoom@2',
        },
        pendingView,
        lastFrameTime
    this.currentTarget = currentTarget
    this.currentView = currentView
    this.setTarget = setTarget
    args.renderers.forEach(r => {
        r.instance = new r.ctor({
            canvas: r.canvas,
            redraw: draw,
            crosshair: args.crosshair,
            minres: args.minres,
        })
        r.canvas.style.display = 'none'
    })
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    resize()

    function draw() {
        if (!af_id)
            af_id = window.requestAnimationFrame(_draw)
    }

    function _draw(now) {
        af_id = null
        var newview = target.travelfunc(now)
        newview.w = w
        newview.h = h
        newview.pixscale = newview.scale * Math.min(w, h)
        if (pendingView && pendingView.renderer && pendingView.renderer.instance.renderShown()) {
            view = pendingView
            lastFrameTime = now - pendingView.renderStart
            pendingView = null
            if (view.renderer.instance.ready &&
                view.w == newview.w &&
                view.h == newview.h &&
                view.ftype == newview.ftype &&
                view.jx == newview.jx &&
                view.jy == newview.jy &&
                view.cx == newview.cx &&
                view.cy == newview.cy &&
                view.scale == newview.scale &&
                view.maxiter == newview.maxiter &&
                view.travel == newview.travel &&
                view.stopped &&
                view.renderer.instance.renderFinished()) {
                if (args.onidle)
                    args.onidle()
                return
            }
        }
        if (pendingView) {
            if (lastFrameTime && newview.scale < pendingView.scale && newview.cx == pendingView.cx && newview.cy == pendingView.cy) {
                view.renderer.instance.rerender(
                    Math.min(
                        pendingView.scale,
                        Math.pow(
                            view.scale,
                            1 + (now - pendingView.renderStart) / lastFrameTime)))
            }
            af_id = window.requestAnimationFrame(_draw)
            return
        }
        args.renderers.forEach(r => {
            if (newview.renderer || !r.instance.ready) {
                if (view.renderer == r)
                    r.canvas.style.display = 'none'
                return
            }
            if (view.renderer != r)
                r.canvas.style.display = 'block'
            newview.renderer = r
        })
        newview.renderStart = now
        update_palette(palette, newview.maxiter)
        newview.renderer.instance.render(newview.ftype, newview.jx, newview.jy, newview.cx, newview.cy, newview.scale, palette)
        if (args.ondraw)
            args.ondraw(newview)
        pendingView = newview
        af_id = window.requestAnimationFrame(_draw)
    }

    function resize() {
        var rw = args.width || window.innerWidth,
            rh = args.height || window.innerHeight
        if (rw == w && rh == h) return
        w = rw
        h = rh
        args.renderers.forEach(r => {
            r.instance.setSize(w, h)
            r.canvas.width = w
            r.canvas.height = h
        })
        target.pixscale = target.scale * Math.min(w, h)
        draw()
    }

    function update_palette(palette, maxiter) {
        if (palette.length == maxiter) return
        for (var i=0; i<=maxiter; i++) {
            var ii = i/maxiter
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
        palette.splice(maxiter)
    }

    function currentTarget() {
        return {
            ftype: target.ftype,
            jx: target.jx,
            jy: target.jy,
            cx: target.cx,
            cy: target.cy,
            scale: target.scale,
            pixscale: target.scale * Math.min(w, h),
            maxiter: target.maxiter,
            travel: target.travel,
            travelfunc: target.travelfunc,
        }
    }

    function currentView() {
        var v = pendingView || view
        return {
            ftype: v.ftype,
            jx: v.jx,
            jy: v.jy,
            cx: v.cx,
            cy: v.cy,
            scale: v.scale,
            pixscale: v.scale * Math.min(w, h),
            maxiter: v.maxiter,
            travel: v.travel,
        }
    }

    function travelfunc(ftype, jx, jy, cx, cy, scale, maxiter, travel, t0) {
        if (typeof travel == 'function') {
            return travel
        }
        var funcandargs = travel.split('@')
        var func = funcandargs[0]
        var args = []
        try {
            args = funcandargs[1].split(',')
        } catch(e) { }
        if (func == 'zoom') {
            const scale0 = 0.25
            const scale1 = scale
            var zoomspeed = travel.split('@')[1].split(',')[0]
            var t1 = t0 + 1000 * Math.log(scale/scale0)/Math.log(2)/zoomspeed
            return function(now) {
                if (now >= t1) {
                    now = t1
                }
                var scale = scale0 * Math.pow(scale1/scale0, (now-t0)/(t1-t0))
                return {
                    ftype: ftype,
                    jx: jx,
                    jy: jy,
                    cx: cx,
                    cy: cy,
                    scale: scale,
                    maxiter: maxiter,
                    travel: travel,
                    stopped: now == t1,
                    t0: t0,
                }
            }
        }
        if (func == 'ellipse') {
            // ellipse@-0.503121934426349,-0.564071589939249,0.0417,0.0417,5,0.5,60
            var ex = parseFloat(args[0])
            var ey = parseFloat(args[1])
            var rx = parseFloat(args[2])
            var ry = parseFloat(args[3])
            var p = parseFloat(args[4]) * 1000
            var spiralmag = parseFloat(args[5])
            var spiralp = parseFloat(args[6] || args[4]) * 1000
            return function(now) {
                var alpha = 2 * Math.PI * (now - t0)
                var spiralfactor = 1 - spiralmag * Math.cos(alpha/spiralp)
                return {
                    ftype: ftype,
                    jx: ex + rx * Math.cos(alpha/p) * spiralfactor,
                    jy: ey + ry * Math.sin(alpha/p) * spiralfactor,
                    cx: cx,
                    cy: cy,
                    scale: scale,
                    maxiter: maxiter,
                    travel: travel,
                    stopped: false,
                    t0: t0,
                }
            }
        }
        return function() {
            return {
                ftype: ftype,
                jx: jx,
                jy: jy,
                cx: cx,
                cy: cy,
                scale: scale,
                maxiter: maxiter,
                travel: travel,
                stopped: true,
            }
        }
    }

    function setTarget(ftype, jx, jy, cx, cy, scale, maxiter, travel) {
        if (cx < -2) cx = -2
        if (cx > 2) cx = 2
        if (cy < -2) cy = -2
        if (cy > 2) cy = 2
        if (scale < 0.25 || scale > 1e12) {
            scale = Math.max(Math.min(scale, 1e12), 0.25)
            cx = target.cx || cx
            cy = target.cy || cy
        }
        target.ftype = ftype
        target.jx = jx
        target.jy = jy
        target.cx = cx
        target.cy = cy
        target.scale = scale
        target.pixscale = scale * Math.min(w, h)
        target.maxiter = maxiter
        target.travel = travel
        target.travelfunc = travelfunc(ftype, jx, jy, cx, cy, scale, maxiter, travel, view.t0 || performance.now())
        view.cx = cx
        view.cy = cy
        view.maxiter = maxiter
        view.travel = travel
        draw()
    }
}
