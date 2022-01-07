function display(renderers) {
    var af_id,
        w,
        h,
        palette = [],
        target = {
            cx: 0,
            cy: 0,
            scale: 1,
            maxiter: 2,
            t1: -1,
        },
        view = {
            cx: 0,
            cy: 0,
            scale: 1,
            maxiter: 2,
        },
        rendering
    this.currentTarget = currentTarget
    this.currentView = currentView
    this.setTarget = setTarget
    renderers.forEach(r => {
        r.instance = new r.ctor(r.canvas)
        r.renderTime = []
        r.canvas.style.display = 'none'
    })
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    resize()
    draw()

    function draw() {
        if (!af_id)
            af_id = window.requestAnimationFrame(_draw)
    }

    function _draw() {
        af_id = null
        var now = performance.now()
        if (now >= target.t1) {
            view.scale = target.scale
            af_want = false
        } else {
            view.scale = target.scale0 * Math.pow(target.scale/target.scale0, (now-target.t0)/(target.t1-target.t0))
            af_want = true
        }
        if (rendering) {
            // todo: rescale existing frame
            af_id = window.requestAnimationFrame(_draw)
            return
        }
        view.pixscale = view.scale * Math.min(w, h)
        update_palette(palette, view.maxiter)
        var done = null
        var promise
        var t0 = performance.now()
        renderers.forEach(r => {
            if (done || !r.instance.ready) {
                if (rendering == r)
                    r.canvas.style.display = 'none'
                return
            }
            if (rendering != r)
                r.canvas.style.display = 'block'
            promise = r.instance.render(view.cx, view.cy, view.scale, palette)
            done = r
        })
        rendering = done
        if (!promise) promise = Promise.reject('no renderer ready')
        promise.then(resolution => {
            rendering.renderTime[resolution] = performance.now() - t0
            rendering = null
        }).catch(err => {
            console.log(err)
        });
        if (view.scale != target.scale)
            af_id = window.requestAnimationFrame(_draw)
    }

    function resize() {
        var rw = window.innerWidth,
            rh = window.innerHeight
        if (rw == w && rh == h) return
        w = rw
        h = rh
        renderers.forEach(r => {
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
            cx: target.cx,
            cy: target.cy,
            scale: target.scale,
            pixscale: target.scale * Math.min(w, h),
            maxiter: target.maxiter,
        }
    }

    function currentView() {
        return {
            cx: view.cx,
            cy: view.cy,
            scale: view.scale,
            pixscale: view.scale * Math.min(w, h),
            maxiter: view.maxiter,
        }
    }

    function setTarget(cx, cy, scale, maxiter, seconds) {
        if (cx < -2) cx = -2
        if (cx > 2) cx = 2
        if (cy < -2) cy = -2
        if (cy > 2) cy = 2
        if (scale < 0.25 || scale > 1e12) {
            scale = Math.max(Math.min(scale, 1e12), 0.25)
            cx = target.cx || cx
            cy = target.cy || cy
        }
        target.cx = cx
        target.cy = cy
        target.scale = scale
        target.pixscale = scale * Math.min(w, h)
        target.maxiter = maxiter
        view.cx = cx
        view.cy = cy
        view.maxiter = maxiter
        if (seconds) {
            target.t0 = performance.now()
            target.t1 = performance.now() + seconds*1000
            target.scale0 = view.scale
        } else
            target.t1 = -1
        draw()
    }
}
