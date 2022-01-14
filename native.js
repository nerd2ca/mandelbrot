function nativeRenderer(canvas, redraw) {
    const initres = 4, flyres = 1, maxfps = 90

    this.setSize = setSize
    this.render = render
    this.renderShown = renderShown
    this.renderFinished = renderFinished
    this.rerender = rerender
    this.ready = true

    var y = 0,
        width = 1,
        height = 1,
        frames = [],
        ctx = canvas.getContext('2d')

    ctx.fillStyle = '#000'

    function setSize(w, h) {
        width = w
        height = h
    }

    function renderFinished() {
        return (frames.length == 0 || frames[0].lores == 0)
    }

    function renderShown() {
        if (frames.length == 0) return true
        for (var t = performance.now(); frames[0].lores >= initres || (frames[0].lores > 0 && performance.now() < t + 1000/maxfps); nextPixelRow(frames[0])) {}
        return frames[0].shown
    }

    function rerender() {
        renderFinished()
    }

    function render(cx, cy, scale, palette) {
        if (frames.length < 1 ||
            frames[0].w != width ||
            frames[0].h != height ||
            frames[0].cx != cx ||
            frames[0].cy != cy ||
            frames[0].scale != scale ||
            frames[0].maxiter != palette.length) {
            y = 0
            frames.unshift({
                w: width,
                h: height,
                sq: Math.min(width, height),
                cx: cx,
                cy: cy,
                scale: scale,
                pixscale: scale * Math.min(width, height),
                palette: palette,
                maxiter: palette.length,
                lores: initres,
                hires: 1,
                buf: new Uint8ClampedArray(width*height*4),
            })
            buf = frames[0].buf
            var ii = 0
            for (var xx = 0; xx < width; xx++)
                for (var yy = 0; yy < width; yy++) {
                    buf[ii+3] = 255
                    ii += 4
                }
            frames.splice(2)
        }
        renderFinished()
    }

    function nextPixelRow(f, palette) {
        var buf = f.buf
        const hw = f.w/2,
              hh = f.h/2
        for (x = 0; x < f.w; x += f.lores)
            if (f.lores == initres ||
                (x % (f.lores*2) > 0) ||
                (y % (f.lores*2) > 0)) {
                const x0 = f.cx + (x-hw)/f.pixscale,
                      y0 = f.cy + (y-hh)/f.pixscale
                var ix = 0,
                    iy = 0,
                    iteration = 0
                while (iteration < f.maxiter-1) {
                    var ix2 = ix*ix,
                        iy2 = iy*iy
                    if (ix2 + iy2 > 4)
                        break
                    var xnext = ix2 - iy2 + x0
                    iy = 2*ix*iy + y0
                    ix = xnext
                    iteration++
                }
                var rgba = f.palette[iteration]
                for (var py = 0; py < f.lores && y+py < f.h; py++) {
                    var i = (((y+py)*f.w)+x)*4
                    for (var px = 0; px < f.lores && x+px < f.w; px++) {
                        buf[i] = rgba[0]
                        buf[i+1] = rgba[1]
                        buf[i+2] = rgba[2]
                        i += 4
                    }
                }
            }

        y += f.lores
        if (y < f.h) return true
        y = 0
        f.lores = Math.floor(f.lores/2)

        ctx.putImageData(new ImageData(f.buf, f.w, f.h), 0, 0)
        f.shown = true

        return f.lores > 0
    }
}
