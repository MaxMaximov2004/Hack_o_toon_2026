import type { MapCell } from '../api/types'
import type { ClientFilter } from '../filters/types'

/**
 * Создаёт DOM-элемент для кластера с кольцом долей ours/others
 */
export function createClusterMarker(cell: MapCell, clientFilter: ClientFilter): HTMLElement {
  const container = document.createElement('div')
  // НЕ устанавливаем position, transform, left, top, margin — это делает MapLibre!
  container.style.cursor = 'pointer'

  // Размер маркера зависит от логарифма количества
  const size = Math.min(60, Math.max(30, 20 + Math.log10(cell.total) * 10))

  // Обёртка для анимации (внутренний элемент)
  const animationWrapper = document.createElement('div')
  animationWrapper.style.transition = 'transform 0.2s'

  // SVG с кольцом
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', size.toString())
  svg.setAttribute('height', size.toString())
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
  svg.style.overflow = 'visible'

  const radius = size / 2 - 3
  const centerX = size / 2
  const centerY = size / 2
  const strokeWidth = 6

  // Вычисляем доли
  const oursRatio = cell.ours / cell.total
  const othersRatio = cell.others / cell.total
  const excludedRatio = cell.excluded / cell.total

  // Функция для создания дуги
  function createArc(
    startAngle: number,
    endAngle: number,
    color: string
  ): SVGPathElement {
    const start = polarToCartesian(centerX, centerY, radius, endAngle)
    const end = polarToCartesian(centerX, centerY, radius, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

    const d = [
      'M',
      start.x,
      start.y,
      'A',
      radius,
      radius,
      0,
      largeArcFlag,
      0,
      end.x,
      end.y,
    ].join(' ')

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', color)
    path.setAttribute('stroke-width', strokeWidth.toString())
    path.setAttribute('stroke-linecap', 'round')

    return path
  }

  function polarToCartesian(
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    }
  }

  // Рисуем дуги в зависимости от фильтра
  let currentAngle = 0

  if (clientFilter === 'all') {
    // Показываем все три сегмента
    if (oursRatio > 0) {
      const arc = createArc(currentAngle, currentAngle + oursRatio * 360, '#7700FF')
      svg.appendChild(arc)
      currentAngle += oursRatio * 360
    }
    if (othersRatio > 0) {
      const arc = createArc(currentAngle, currentAngle + othersRatio * 360, '#FF4F12')
      svg.appendChild(arc)
      currentAngle += othersRatio * 360
    }
    if (excludedRatio > 0) {
      const arc = createArc(currentAngle, currentAngle + excludedRatio * 360, '#9AA4B2')
      svg.appendChild(arc)
    }
  } else if (clientFilter === 'ours') {
    // Только фиолетовое кольцо
    const arc = createArc(0, 360, '#7700FF')
    svg.appendChild(arc)
  } else if (clientFilter === 'others') {
    // Только оранжевое кольцо
    const arc = createArc(0, 360, '#FF4F12')
    svg.appendChild(arc)
  }

  // Внутренний круг с числом
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', centerX.toString())
  circle.setAttribute('cy', centerY.toString())
  circle.setAttribute('r', (radius - strokeWidth / 2 - 1).toString())
  circle.setAttribute('fill', 'white')
  circle.setAttribute('stroke', '#E3E8EC')
  circle.setAttribute('stroke-width', '1')
  svg.appendChild(circle)

  // Текст с числом
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('x', centerX.toString())
  text.setAttribute('y', centerY.toString())
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dominant-baseline', 'central')
  text.setAttribute('font-size', (size * 0.35).toString())
  text.setAttribute('font-weight', 'bold')
  text.setAttribute('fill', '#101828')
  text.textContent = cell.total >= 1000 ? `${Math.floor(cell.total / 1000)}k` : cell.total.toString()
  svg.appendChild(text)

  animationWrapper.appendChild(svg)
  container.appendChild(animationWrapper)

  // Hover эффект на ВНУТРЕННЕМ элементе, не на корневом контейнере
  container.addEventListener('mouseenter', () => {
    animationWrapper.style.transform = 'scale(1.1)'
  })
  container.addEventListener('mouseleave', () => {
    animationWrapper.style.transform = 'scale(1)'
  })

  return container
}
