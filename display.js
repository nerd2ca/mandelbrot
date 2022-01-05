function display(renderers) {
    var target = {
        cx: 0,
        cy: 0,
        scale: 1,
        maxiter: 2,
    }
    var af_id, w, h, palette = []
    function start() {
        if (!af_id)
            af_id = window.requestAnimationFrame(draw)
    }
    function stop() {
        if (af_id)
            window.cancelAnimationFrame(af_id)
    }
    function draw() {
        af_id = null
        update_palette(palette, target.maxiter)
        var done = false
        renderers.forEach(r => {
            if (done || !r.instance.ready) {
                r.canvas.style.display = 'none'
                return
            }
            r.canvas.style.display = 'block'
            r.instance.render(target.cx, target.cy, target.scale, palette)
            done = true
        })
        af_id = window.requestAnimationFrame(draw)
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
    ['resize', 'orientationchange'].forEach(et => {
        window.addEventListener(et, resize)
    })
    this.currentTarget = () => {
        return {
            cx: target.cx,
            cy: target.cy,
            scale: target.scale,
            pixscale: target.scale * Math.min(w, h),
            maxiter: target.maxiter,
        }
    }
    this.setTarget = (cx, cy, scale, maxiter, seconds) => {
        target.cx = cx
        target.cy = cy
        target.scale = scale
        target.pixscale = scale * Math.min(w, h)
        target.maxiter = maxiter
    }
    renderers.forEach(r => {
        r.instance = new r.ctor(r.canvas)
    })
    resize()
    start()
}
