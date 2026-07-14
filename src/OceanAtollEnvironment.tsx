import { useEffect, useRef } from 'react'

const oceanVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const oceanFragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uPointer;
  uniform vec2 uResolution;

  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
      local.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.52;
    for (int octave = 0; octave < 4; octave++) {
      value += noise(point) * amplitude;
      point = point * 2.03 + vec2(8.7, 3.1);
      amplitude *= 0.48;
    }
    return value;
  }

  float ridge(float value, float width) {
    return pow(1.0 - abs(sin(value)), width);
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 point = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
    vec2 verticalTide = vec2(uScroll * 0.05, -uTime * 0.025 - uScroll * 0.58);

    float basin = fbm(point * 1.22 + verticalTide * 0.18);
    float broadFlow = fbm(point * 2.55 + vec2(basin * 0.42, -basin * 0.28) + verticalTide);
    vec2 warped = point + vec2(broadFlow - 0.5, basin - 0.5) * 0.16;
    float fineFlow = fbm(warped * 8.4 + vec2(uTime * 0.034, -uTime * 0.052));

    float depthField = smoothstep(0.12, 0.9, basin * 0.72 + broadFlow * 0.42);
    depthField += sin(point.y * 2.2 - uScroll * 1.4) * 0.035;

    vec3 deepPacific = vec3(0.025, 0.19, 0.31);
    vec3 middlePacific = vec3(0.055, 0.39, 0.50);
    vec3 shallowLagoon = vec3(0.22, 0.62, 0.67);
    vec3 water = mix(deepPacific, middlePacific, smoothstep(0.06, 0.74, depthField));
    water = mix(water, shallowLagoon, smoothstep(0.62, 1.08, depthField + fineFlow * 0.13));

    float longCrest = ridge(warped.y * 12.0 + warped.x * 3.6 - uTime * 0.5 + broadFlow * 3.0, 18.0);
    float crossCrest = ridge(warped.x * 18.0 - warped.y * 5.2 + uTime * 0.36 + fineFlow * 2.2, 22.0);
    float waveLight = longCrest * (0.34 + fineFlow * 0.66) + crossCrest * 0.26;
    water += vec3(0.39, 0.69, 0.70) * waveLight * (0.08 + depthField * 0.22);

    float causticA = ridge((warped.x + fineFlow * 0.08) * 28.0 + uTime * 0.33, 12.0);
    float causticB = ridge((warped.y - broadFlow * 0.08) * 31.0 - uTime * 0.29, 14.0);
    float caustics = min(1.0, causticA + causticB) * smoothstep(0.43, 0.92, depthField);
    water += vec3(0.52, 0.77, 0.74) * caustics * 0.09;

    vec2 sunPoint = vec2(0.22 + uPointer.x * 0.025, 0.16 + uPointer.y * 0.02);
    float sunPath = 1.0 - smoothstep(0.0, 0.46, distance(vUv, sunPoint));
    float brokenLight = smoothstep(0.54, 0.88, fineFlow + longCrest * 0.22);
    vec3 goldenPink = vec3(0.98, 0.55, 0.52);
    vec3 lilacLight = vec3(0.56, 0.48, 0.76);
    water += mix(goldenPink, lilacLight, smoothstep(0.0, 1.0, vUv.x)) * sunPath * brokenLight * 0.17;

    float surfaceShade = mix(0.93, 1.07, smoothstep(0.24, 0.82, broadFlow));
    water *= surfaceShade;
    water += (hash(gl_FragCoord.xy + floor(uTime * 18.0)) - 0.5) * 0.006;

    gl_FragColor = vec4(water, 1.0);
  }
`

type OceanAtollEnvironmentProps = {
  reducedMotion: boolean
}

type GrainPoint = {
  alpha: number
  radius: number
  x: number
  y: number
}

type SandShape = {
  coast: Path2D
  fill: Path2D
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function createSideBank(
  side: 'left' | 'right',
  width: number,
  height: number,
  phase: number,
) : SandShape {
  const fill = new Path2D()
  const coast = new Path2D()
  const isLeft = side === 'left'
  const widthRatio = isLeft ? 0.078 : 0.064
  const bankWidth = Math.min(width * (width < 700 ? widthRatio * 0.82 : widthRatio), width < 700 ? 34 : 112)
  const outerX = isLeft ? 0 : width
  const points: Array<{ x: number; y: number }> = []

  for (let y = -24; y <= height + 48; y += width < 700 ? 54 : 76) {
    const drift = Math.sin(y * 0.009 + phase) * (width < 700 ? 5 : 14)
      + Math.sin(y * 0.019 - phase * 0.63) * (width < 700 ? 2 : 7)
      + Math.sin(y * 0.003 + phase * 1.4) * (width < 700 ? 3 : 11)
    const inset = bankWidth + drift + Math.sin(phase * 0.37) * 4
    points.push({ x: isLeft ? inset : width - inset, y })
  }

  coast.moveTo(points[0].x, points[0].y)
  fill.moveTo(outerX, 0)
  fill.lineTo(points[0].x, points[0].y)

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const midpointX = (previous.x + current.x) * 0.5
    const midpointY = (previous.y + current.y) * 0.5
    coast.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY)
    fill.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY)
  }

  const last = points[points.length - 1]
  coast.lineTo(last.x, last.y)
  fill.lineTo(last.x, last.y)
  fill.lineTo(outerX, height)
  fill.closePath()
  return { coast, fill }
}

function createBottomBank(width: number, height: number, phase: number): SandShape {
  const fill = new Path2D()
  const coast = new Path2D()
  const bankHeight = Math.min(height * (width < 700 ? 0.105 : 0.13), width < 700 ? 82 : 124)
  const points: Array<{ x: number; y: number }> = []

  for (let x = -40; x <= width + 60; x += width < 700 ? 48 : 68) {
    const channel = Math.exp(-Math.pow((x - width * 0.58) / (width * 0.17), 2)) * (width < 700 ? 26 : 54)
    const tide = Math.sin(x * 0.009 + phase * 0.82) * (width < 700 ? 7 : 15)
      + Math.sin(x * 0.021 - phase * 0.41) * (width < 700 ? 3 : 7)
      - channel
    points.push({ x, y: height - bankHeight + tide })
  }

  coast.moveTo(points[0].x, points[0].y)
  fill.moveTo(0, height)
  fill.lineTo(points[0].x, points[0].y)

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const midpointX = (previous.x + current.x) * 0.5
    const midpointY = (previous.y + current.y) * 0.5
    coast.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY)
    fill.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY)
  }

  const last = points[points.length - 1]
  coast.lineTo(last.x, last.y)
  fill.lineTo(last.x, last.y)
  fill.lineTo(width, height)
  fill.closePath()
  return { coast, fill }
}

function createShoal(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  phase: number,
) : SandShape {
  const fill = new Path2D()

  for (let index = 0; index <= 32; index += 1) {
    const angle = (index / 32) * Math.PI * 2
    const wobble = 1 + Math.sin(angle * 3 + phase) * 0.11 + Math.sin(angle * 5 - phase) * 0.05
    const x = centerX + Math.cos(angle) * radiusX * wobble
    const y = centerY + Math.sin(angle) * radiusY * wobble

    if (index === 0) {
      fill.moveTo(x, y)
    } else {
      fill.lineTo(x, y)
    }
  }

  fill.closePath()
  return { coast: new Path2D(fill), fill }
}

export default function OceanAtollEnvironment({ reducedMotion }: OceanAtollEnvironmentProps) {
  const oceanCanvasRef = useRef<HTMLCanvasElement>(null)
  const sandCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = oceanCanvasRef.current

    if (!canvas) {
      return
    }

    let disposed = false
    let animationFrame = 0
    let renderer: import('three').WebGLRenderer | null = null
    let geometry: import('three').PlaneGeometry | null = null
    let material: import('three').ShaderMaterial | null = null
    let camera: import('three').OrthographicCamera | null = null
    let scene: import('three').Scene | null = null
    let lastFrame = 0
    const pointer = { x: 0, y: 0 }
    const pointerTarget = { x: 0, y: 0 }
    let scrollProgress = 0

    const updatePointer = (event: globalThis.PointerEvent) => {
      pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * 2
      pointerTarget.y = (event.clientY / window.innerHeight - 0.5) * -2
    }

    const updateScroll = () => {
      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      scrollProgress = window.scrollY / scrollRange
    }

    const startRenderer = async () => {
      const THREE = await import('./oceanThree')

      if (disposed) {
        return
      }

      try {
        renderer = new THREE.WebGLRenderer({
          alpha: false,
          antialias: false,
          canvas,
          powerPreference: 'high-performance',
        })
      } catch {
        canvas.dataset.oceanStatus = 'fallback'
        return
      }

      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.08
      renderer.setClearColor(0x07516f, 1)

      scene = new THREE.Scene()
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
      camera.position.z = 1
      geometry = new THREE.PlaneGeometry(2, 2, 1, 1)

      material = new THREE.ShaderMaterial({
        fragmentShader: oceanFragmentShader,
        uniforms: {
          uPointer: { value: new THREE.Vector2(0, 0) },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uScroll: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: oceanVertexShader,
      })

      scene.add(new THREE.Mesh(geometry, material))

      const resize = () => {
        if (!renderer || !camera || !material) {
          return
        }

        const width = window.innerWidth
        const height = window.innerHeight
        const pixelRatioLimit = width <= 720 ? 1.1 : 1.45
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit))
        renderer.setSize(width, height, false)
        material.uniforms.uResolution.value.set(width, height)
      }

      const render = (time: number) => {
        animationFrame = window.requestAnimationFrame(render)

        if (!renderer || !camera || !scene || !material || document.hidden) {
          return
        }

        const frameInterval = window.matchMedia('(pointer: coarse)').matches ? 1000 / 30 : 1000 / 60

        if (!reducedMotion && time - lastFrame < frameInterval) {
          return
        }

        lastFrame = time
        pointer.x += (pointerTarget.x - pointer.x) * 0.035
        pointer.y += (pointerTarget.y - pointer.y) * 0.035
        material.uniforms.uTime.value = reducedMotion ? 5.4 : time * 0.001
        material.uniforms.uScroll.value = scrollProgress
        material.uniforms.uPointer.value.set(pointer.x, pointer.y)
        renderer.render(scene, camera)
        canvas.dataset.oceanStatus = 'ready'

        if (reducedMotion) {
          window.cancelAnimationFrame(animationFrame)
        }
      }

      updateScroll()
      resize()
      window.addEventListener('pointermove', updatePointer, { passive: true })
      window.addEventListener('resize', resize)
      window.addEventListener('scroll', updateScroll, { passive: true })
      animationFrame = window.requestAnimationFrame(render)

      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault()
        canvas.dataset.oceanStatus = 'lost'
      })

      return () => {
        window.removeEventListener('pointermove', updatePointer)
        window.removeEventListener('resize', resize)
        window.removeEventListener('scroll', updateScroll)
      }
    }

    let removeRendererListeners: (() => void) | undefined
    void startRenderer().then((cleanup) => {
      removeRendererListeners = cleanup
    })

    return () => {
      disposed = true
      removeRendererListeners?.()
      window.cancelAnimationFrame(animationFrame)
      geometry?.dispose()
      material?.dispose()
      renderer?.dispose()
    }
  }, [reducedMotion])

  useEffect(() => {
    const canvas = sandCanvasRef.current

    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d', { alpha: true })

    if (!context) {
      canvas.dataset.sandStatus = 'fallback'
      return
    }

    let animationFrame = 0
    let lastFrame = 0
    let width = 0
    let height = 0
    let pixelRatio = 1
    let scrollPhase = 0
    let grain: GrainPoint[] = []

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      pixelRatio = Math.min(window.devicePixelRatio || 1, width <= 720 ? 1 : 1.2)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const random = createSeededRandom(Math.round(width * 13 + height * 17))
      const pointCount = width <= 720 ? 360 : 960
      grain = Array.from({ length: pointCount }, () => ({
        alpha: 0.05 + random() * 0.13,
        radius: 0.35 + random() * 1.15,
        x: random() * width,
        y: random() * height,
      }))
    }

    const updateScroll = () => {
      scrollPhase = window.scrollY * 0.0011
    }

    const paintPath = (
      shape: SandShape,
      fill: CanvasGradient | string,
      grainOpacity = 1,
      drawCoast = true,
    ) => {
      context.save()
      context.shadowBlur = width <= 720 ? 14 : 26
      context.shadowColor = 'rgba(250, 220, 203, 0.42)'
      context.filter = drawCoast ? 'none' : `blur(${width <= 720 ? 7 : 12}px)`
      context.fillStyle = fill
      context.fill(shape.fill)
      context.filter = 'none'
      context.shadowBlur = 0

      context.clip(shape.fill)
      for (const point of grain) {
        context.beginPath()
        context.fillStyle = `rgba(119, 86, 83, ${point.alpha * grainOpacity})`
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()

      if (drawCoast) {
        context.save()
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = 'rgba(82, 169, 180, 0.16)'
        context.lineWidth = width <= 720 ? 17 : 28
        context.shadowBlur = width <= 720 ? 14 : 24
        context.shadowColor = 'rgba(94, 199, 208, 0.38)'
        context.stroke(shape.coast)
        context.shadowBlur = width <= 720 ? 8 : 15
        context.shadowColor = 'rgba(255, 246, 236, 0.7)'
        context.strokeStyle = 'rgba(255, 250, 241, 0.34)'
        context.lineWidth = width <= 720 ? 2.5 : 4
        context.stroke(shape.coast)
        context.restore()
      }
    }

    const draw = (time: number) => {
      animationFrame = window.requestAnimationFrame(draw)
      const frameInterval = width <= 720 ? 1000 / 12 : 1000 / 18

      if (!reducedMotion && time - lastFrame < frameInterval) {
        return
      }

      lastFrame = time
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)

      const motion = reducedMotion ? 1.7 : time * 0.00022
      const phase = motion + scrollPhase
      const sandGradient = context.createLinearGradient(0, 0, width, height)
      sandGradient.addColorStop(0, 'rgba(239, 197, 177, 0.94)')
      sandGradient.addColorStop(0.42, 'rgba(248, 218, 191, 0.94)')
      sandGradient.addColorStop(0.76, 'rgba(231, 201, 212, 0.92)')
      sandGradient.addColorStop(1, 'rgba(209, 191, 222, 0.9)')

      paintPath(createSideBank('left', width, height, phase), sandGradient)
      paintPath(createSideBank('right', width, height, phase + 2.1), sandGradient)
      paintPath(createBottomBank(width, height, phase + 0.8), sandGradient)

      if (width > 720) {
        const shoalGradient = context.createRadialGradient(
          width * 0.7,
          height * 0.31,
          0,
          width * 0.7,
          height * 0.31,
          width * 0.16,
        )
        shoalGradient.addColorStop(0, 'rgba(247, 213, 190, 0.36)')
        shoalGradient.addColorStop(0.68, 'rgba(233, 198, 205, 0.12)')
        shoalGradient.addColorStop(1, 'rgba(233, 198, 205, 0)')
        paintPath(
          createShoal(width * 0.73, height * 0.3, width * 0.105, height * 0.055, phase),
          shoalGradient,
          0.2,
          false,
        )
      }

      canvas.dataset.sandStatus = 'ready'

      if (reducedMotion) {
        window.cancelAnimationFrame(animationFrame)
      }
    }

    resize()
    updateScroll()
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', updateScroll, { passive: true })
    animationFrame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', updateScroll)
    }
  }, [reducedMotion])

  return (
    <div aria-hidden="true" className="atoll-environment">
      <canvas className="ocean-depth-canvas" ref={oceanCanvasRef} />
      <canvas className="atoll-sand-canvas" ref={sandCanvasRef} />
      <div className="atoll-light-field" />
    </div>
  )
}
