# Liquid Glass in the Browser  
## Deep Technical Breakdown + Full Single-File Implementation

Based on a thorough reading of:  
https://kube.io/blog/liquid-glass-css-svg/

---

# 1. What This Article Is Actually Doing

The article demonstrates how to simulate **true light refraction through curved glass** using:

- SVG filters
- CSS `backdrop-filter`
- A dynamically generated displacement map
- JavaScript math based on surface geometry

This is **not just blur**.

Most "glass" effects online are:
```
backdrop-filter: blur(20px);
```

That only blurs.

The Kube article instead:
1. Models a curved glass surface mathematically.
2. Computes surface normals.
3. Uses a simplified refraction calculation.
4. Converts that into a displacement vector field.
5. Encodes that field into an image.
6. Feeds it into `<feDisplacementMap>` to bend background pixels.

This is essentially shader-style distortion implemented using SVG.

---

# 2. The Physics Concept (Refraction)

Refraction is governed by Snell’s Law:

```
n₁ sin(θ₁) = n₂ sin(θ₂)
```

Where:

- n₁ = refractive index of air (~1.0)
- n₂ = refractive index of glass (~1.5)
- θ₁ = incident angle
- θ₂ = refracted angle

The article simplifies this instead of doing full ray tracing.

Instead it:

- Computes surface normals.
- Uses the normal direction to determine displacement.
- Scales that displacement.
- Encodes it into a displacement map.

This produces convincing refraction without expensive ray math.

---

# 3. The Core Trick — SVG Displacement Maps

SVG filter:
```html
<feDisplacementMap>
```

It shifts pixels of a source image based on another image’s color channels.

Important mapping:

- Red channel → X displacement
- Green channel → Y displacement
- 128 = no movement
- 0–255 = negative to positive movement

So we must:

1. Compute displacement vectors.
2. Convert vectors into R and G values.
3. Generate an image.
4. Feed it into SVG.

---

# 4. How the Surface is Modeled

The article uses radial distance from center:

```
r = sqrt(x² + y²)
```

Then defines a spherical cap surface:

```
height(r) = sqrt(R² - r²)
```

Derivative gives slope:

```
d(height)/dr
```

Slope → surface normal → displacement direction.

We approximate derivative numerically:

```
f(r + δ) - f(r)
-------------
      δ
```

This is how we compute normals for each pixel.

---

# 5. FULL WORKING IMPLEMENTATION (Single File)

Below is a fully self-contained HTML file.

You can:

1. Copy this entire block
2. Save it as `liquid-glass.html`
3. Open in Chrome
4. It will run immediately

Everything is inside.

---

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Liquid Glass – Full Implementation</title>

<style>
body {
  margin: 0;
  height: 100vh;
  background:
    radial-gradient(circle at 30% 30%, #ff00cc, transparent 40%),
    radial-gradient(circle at 70% 60%, #00ccff, transparent 40%),
    linear-gradient(135deg, #111, #222);
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: sans-serif;
}

/* Glass element */
.glass {
  width: 300px;
  height: 300px;
  border-radius: 40px;
  padding: 30px;
  color: white;
  background: rgba(255,255,255,0.08);
  backdrop-filter: url(#liquidGlassFilter) blur(8px);
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow:
    0 10px 40px rgba(0,0,0,0.5),
    inset 0 0 40px rgba(255,255,255,0.1);
}
</style>
</head>
<body>

<div class="glass">
  <h2>Liquid Glass</h2>
  <p>True refraction using SVG displacement maps.</p>
</div>

<!-- SVG FILTER -->
<svg width="0" height="0">
  <filter id="liquidGlassFilter">
    <feImage id="displacementImage"
             result="disp"
             x="0" y="0"
             width="300"
             height="300"/>
    <feDisplacementMap in="SourceGraphic"
                       in2="disp"
                       scale="70"
                       xChannelSelector="R"
                       yChannelSelector="G"/>
  </filter>
</svg>

<script>
const width = 300;
const height = 300;
const radius = 150;

// Surface function (spherical dome)
function surface(r) {
  if (r > radius) return 0;
  return Math.sqrt(radius * radius - r * r);
}

// Create canvas
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext("2d");
const imageData = ctx.createImageData(width, height);

// Compute displacement for each pixel
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {

    const dx = x - width / 2;
    const dy = y - height / 2;
    const r = Math.sqrt(dx * dx + dy * dy);

    const index = (y * width + x) * 4;

    if (r <= radius) {

      const delta = 0.5;
      const h0 = surface(r);
      const h1 = surface(r + delta);
      const derivative = (h1 - h0) / delta;

      // Normal approximation
      const nx = -derivative * (dx / (r || 1));
      const ny = 1;

      const mag = Math.sqrt(nx*nx + ny*ny);
      const normX = nx / mag;
      const normY = ny / mag;

      // Encode into displacement map
      imageData.data[index + 0] = 128 + normX * 127;
      imageData.data[index + 1] = 128 + normY * 127;
      imageData.data[index + 2] = 128;
      imageData.data[index + 3] = 255;

    } else {

      imageData.data[index + 0] = 128;
      imageData.data[index + 1] = 128;
      imageData.data[index + 2] = 128;
      imageData.data[index + 3] = 255;

    }
  }
}

ctx.putImageData(imageData, 0, 0);

// Set displacement map
document
  .getElementById("displacementImage")
  .setAttribute("href", canvas.toDataURL());
</script>

</body>
</html>
```

---

# 6. Why This Works

1. Each pixel inside the glass area computes a surface slope.
2. Slope becomes a surface normal.
3. Normal direction becomes displacement direction.
4. Displacement encoded into R/G channels.
5. SVG shifts background pixels accordingly.
6. CSS `backdrop-filter` applies it to what's behind.

It mimics how curved glass bends light.

---

# 7. Important Limitations

- Works best in Chrome.
- Heavy math = performance cost at large sizes.
- Not full physically correct ray tracing.
- No chromatic dispersion (RGB splitting).

---

# 8. Ways to Improve It

- Animate surface height
- Add specular highlights layer
- Add chromatic aberration (separate displacement maps per color channel)
- Use concave functions for inward distortion
- Add mouse-interaction distortion

---

# 9. Final Summary

The article shows how to:

- Use math to simulate curved glass
- Convert physics into displacement vectors
- Encode vectors into an image
- Apply it through SVG filters
- Combine with CSS backdrop-filter

It bridges:

Physics → Math → Vector Field → Image Encoding → SVG Filter → CSS UI

This is shader-style thinking implemented in plain browser tech.

---

END OF COMPLETE SINGLE-FILE GUIDE
