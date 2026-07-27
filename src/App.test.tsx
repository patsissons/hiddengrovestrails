import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// jsdom has no WebGL; MapView's maplibre map never gets past construction.
vi.mock('maplibre-gl', () => {
  class FakeEvented {
    on() {
      return this
    }
    off() {
      return this
    }
  }
  class FakeMap extends FakeEvented {
    addControl() {}
    remove() {}
    getCanvas() {
      return { style: {} }
    }
    getStyle() {
      return { layers: [] }
    }
    addSource() {}
    addLayer() {}
    setFilter() {}
    setPaintProperty() {}
    setLayoutProperty() {}
  }
  class FakeControl {}
  const api = { Map: FakeMap, NavigationControl: FakeControl, GeolocateControl: FakeControl }
  return { default: api, ...api }
})

describe('App', () => {
  it('renders the app title and map container', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Hidden Groves Trails' })).toBeInTheDocument()
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders the layer toggles with all groups enabled', () => {
    render(<App />)
    for (const name of ['Trails', 'Junctions', 'Route']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
    }
  })
})
