import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RoutePanel from './RoutePanel'
import CandidateList from './CandidateList'
import { tinyGraph } from '@/test/fixtures/tiny-graph'
import { resolveRoute } from '@/lib/route/validate'
import type { RouteToken } from '@/lib/route/codec'

function routeFor(tokens: RouteToken[]) {
  const resolved = resolveRoute(tinyGraph, tokens)
  if (!resolved.ok) throw new Error('bad route')
  return resolved.route
}

describe('RoutePanel', () => {
  it('prompts to start when no route exists', () => {
    render(
      <RoutePanel
        graph={tinyGraph}
        tokens={[]}
        route={null}
        candidates={[]}
        lastJunction={null}
        onSelect={vi.fn()}
        onUndo={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByText(/tap any numbered intersection/i)).toBeInTheDocument()
  })

  it('shows sequence chips, stats, and steps with color names', () => {
    const tokens: RouteToken[] = [{ junction: 1 }, { junction: 2 }, { junction: 3, alt: 'b' }]
    render(
      <RoutePanel
        graph={tinyGraph}
        tokens={tokens}
        route={routeFor(tokens)}
        candidates={[2, 4]}
        lastJunction={3}
        onSelect={vi.fn()}
        onUndo={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByTestId('route-sequence')).toHaveTextContent('123b')
    // total = 3 + 5 (alt edge)
    expect(screen.getByTestId('stats-summary')).toHaveTextContent('~8 min')
    const steps = screen.getByTestId('step-list')
    expect(steps).toHaveTextContent('follow Red')
    expect(steps).toHaveTextContent('follow Yellow')
  })

  it('fires undo and clear', () => {
    const onUndo = vi.fn()
    const onClear = vi.fn()
    const tokens: RouteToken[] = [{ junction: 1 }, { junction: 2 }]
    render(
      <RoutePanel
        graph={tinyGraph}
        tokens={tokens}
        route={routeFor(tokens)}
        candidates={[1, 3, 4]}
        lastJunction={2}
        onSelect={vi.fn()}
        onUndo={onUndo}
        onClear={onClear}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove last stop/i }))
    fireEvent.click(screen.getByRole('button', { name: /clear route/i }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
  })
})

describe('CandidateList', () => {
  it('renders one button per edge including parallel alternatives', () => {
    const onSelect = vi.fn()
    render(<CandidateList graph={tinyGraph} from={2} candidates={[1, 3, 4]} onSelect={onSelect} />)
    const buttons = screen.getAllByRole('button')
    // 1 (one edge) + 3 (two parallel edges) + 4 (one edge)
    expect(buttons).toHaveLength(4)
    expect(screen.getByText(/via Yellow/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/via Yellow/).closest('button')!)
    expect(onSelect).toHaveBeenCalledWith(3, 'b')
  })
})
