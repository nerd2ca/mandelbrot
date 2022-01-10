function nativeRenderer(canvas) {
    const initres = 4, flyres = 1

    this.setSize = setSize
    this.render = render
    this.renderFinished = renderFinished
    this.rerender = rerender
    this.ready = true

    var x = 0,
        y = 0,
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
        if (frames.length == 0) return true
        for (var t = performance.now(); frames[0].lores >= initres || (frames[0].lores > 0 && performance.now() < t + 1000/60); nextPixel(frames[0])) {}
        return frames[0].lores < initres
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
            x = 0
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
            frames.splice(2)
        }
        renderFinished()
    }

    function nextPixel(f, palette) {
        if (f.lores == initres ||
            (x % (f.lores*2) > 0) ||
            (y % (f.lores*2) > 0)) {
            var x0 = f.cx + (x-f.w/2)/f.pixscale
            var y0 = f.cy + (y-f.h/2)/f.pixscale
            var ix = 0
            var iy = 0
            var iteration = 0
            while (iteration < f.maxiter-1) {
                var ix2 = ix*ix, iy2 = iy*iy
                if (ix2 + iy2 > 4) break
                var xnext = ix2 - iy2 + x0
                iy = 2*ix*iy + y0
                ix = xnext
                iteration++
            }
            var rgba = f.palette[iteration]
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

        if (x < f.w) return true
        x = 0
        y += f.lores
        if (y < f.h) return true
        y = 0
        f.lores = Math.floor(f.lores/2)

        createImageBitmap(new ImageData(f.buf, f.w), 0, 0, f.w, f.h, {
            resizeWidth: f.w,
            resizeHeight: f.h,
        }).then((img) => {
            f.img = img
            if (f == frames[0]) {
                ctx.fillRect(0, 0, width, height)
                ctx.drawImage(img, 0, 0, width, height)
            }
        })

        return f.lores > 0
    }
}
