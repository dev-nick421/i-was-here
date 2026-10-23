import type { Scene, SceneNode } from '~/core/scene'
import { drawText } from './text'

/** Draws all overlay nodes of a scene (everything except paper and map) at `scale` px/unit. */
export function drawSceneNodes(ctx: CanvasRenderingContext2D, scene: Scene, scale: number) {
  for (const node of scene.nodes) drawNode(ctx, node, scale)
}

function drawNode(ctx: CanvasRenderingContext2D, n: SceneNode, s: number) {
  switch (n.kind) {
    case 'rect': {
      ctx.fillStyle = n.fill
      ctx.fillRect(n.rect.x * s, n.rect.y * s, n.rect.w * s, n.rect.h * s)
      break
    }
    case 'fade': {
      const y0 = n.rect.y * s
      const y1 = (n.rect.y + n.rect.h) * s
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, transparent(n.color))
      // An eased ramp avoids the visible "edge" of a linear gradient.
      for (const t of [0.25, 0.5, 0.75]) g.addColorStop(n.solidFrom * t, withOpacity(n.color, t * t * (3 - 2 * t)))
      g.addColorStop(n.solidFrom, n.color)
      g.addColorStop(1, n.color)
      ctx.fillStyle = g
      ctx.fillRect(n.rect.x * s, y0, n.rect.w * s, y1 - y0)
      break
    }
    case 'strokeRect': {
      ctx.strokeStyle = n.color
      ctx.lineWidth = n.width * s
      ctx.strokeRect(n.rect.x * s, n.rect.y * s, n.rect.w * s, n.rect.h * s)
      break
    }
    case 'strokeCircle': {
      ctx.strokeStyle = n.color
      ctx.lineWidth = n.width * s
      ctx.beginPath()
      ctx.arc(n.cx * s, n.cy * s, n.r * s, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'line': {
      ctx.strokeStyle = n.color
      ctx.lineWidth = n.width * s
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.moveTo(n.x1 * s, n.y1 * s)
      ctx.lineTo(n.x2 * s, n.y2 * s)
      ctx.stroke()
      break
    }
    case 'text': {
      drawText(ctx, { text: n.text, x: n.x * s, y: n.y * s, align: n.align, style: n.style, scale: s, halo: n.halo })
      break
    }
  }
}

function transparent(hex: string) {
  return withOpacity(hex, 0)
}

function withOpacity(color: string, a: number) {
  if (color.startsWith('#') && color.length === 7) {
    const r = Number.parseInt(color.slice(1, 3), 16)
    const g = Number.parseInt(color.slice(3, 5), 16)
    const b = Number.parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  return color
}

/** Clips subsequent drawing to the map area (rect or circle). */
export function clipToMap(ctx: CanvasRenderingContext2D, scene: Scene, s: number) {
  const r = scene.map.rect
  ctx.beginPath()
  if (scene.map.shape === 'circle') {
    ctx.arc((r.x + r.w / 2) * s, (r.y + r.h / 2) * s, (r.w / 2) * s, 0, Math.PI * 2)
  } else {
    ctx.rect(r.x * s, r.y * s, r.w * s, r.h * s)
  }
  ctx.clip()
}
