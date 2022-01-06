function nativeRenderer() {
    this.setSize = () => {}
    this.render = () => { return Promise.resolve(1) }
    this.ready = false
    return

    const initres = 8
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
        update_palette(palette, max_iteration)
        x = 0
        y = 0
        frames = [newframe(1/2.47)]
        if (af_id)
            window.cancelAnimationFrame(af_id)
        af_id = window.requestAnimationFrame(animationFrame)
        af_t = null
    }
    function trygl() {
        if (!GlRender)
            return false
        var sq = Math.min(plane.width, plane.height)
        var x = touching.startx - plane.width/2
        var y = touching.starty - plane.height/2
        var rcx = cx + x/sq/scaletarget*(1 - 1/touching.scale)
        var rcy = cy + y/sq/scaletarget*(1 - 1/touching.scale)
        var scale = scaletarget * touching.scale
        rcx -= touching.dx/sq/scale
        rcy -= touching.dy/sq/scale
        GlRender(rcx - dragging.x / scaletarget / sq,
                 rcy - dragging.y / scaletarget / sq,
                 scale, palette)
        return true
    }
    function animationFrame(t) {
        if (trygl())
            return window.requestAnimationFrame(animationFrame)
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
        max_iteration = Math.min(glMaxIteration, Math.max(16, Math.ceil(max_iteration * factor)))
        update_palette(palette, max_iteration)
        recentre()
        mandelbrot.zero()
    }
    mandelbrot.zoom_n_move = (x, y, magnify, dx, dy) => {
        var scale = (!GlRender && frames.length > 0) ? frames[0].scale : scaletarget
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
        }, 250)
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
        if (GlRender) return
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
