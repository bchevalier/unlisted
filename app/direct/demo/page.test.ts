import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DirectDemoFlow from './direct-demo-flow'

describe('Direct demo page', () => {
  it('renders the setup and selected-request stages with the default category and request', () => {
    const html = renderToStaticMarkup(React.createElement(DirectDemoFlow))

    expect(html).toContain('Live Direct demo')
    expect(html).toContain('Watch one request travel through the Knokio access layer.')
    expect(html).toContain('Step 1')
    expect(html).toContain('Choose your setup')
    expect(html).toContain('Step 2')
    expect(html).toContain('Selected request')
    expect(html).toContain('Creator / Influencer')
    expect(html).toContain('Filter sponsorship inbound before it becomes DM chaos.')
    expect(html).toContain('Brand collaboration proposal')
    expect(html).toContain('Spring capsule launch sponsorship')
    expect(html).toContain('Subject')
    expect(html).toContain('Process Request')
  })

  it('renders the request frame and hides later stages until processing starts', () => {
    const html = renderToStaticMarkup(React.createElement(DirectDemoFlow))

    expect(html).toContain('Brand sponsorship')
    expect(html).toContain('North Lane Studio')
    expect(html).toContain('From')
    expect(html).toContain('To')
    expect(html).toContain('Process Request')
    expect(html).not.toContain('Routing outcome')
    expect(html).not.toContain('Create your Direct page')
  })
})
