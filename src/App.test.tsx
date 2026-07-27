import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Hidden Groves Trails' })).toBeInTheDocument()
  })

  it('renders exactly one heading per mount', () => {
    render(<App />)
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })
})
